# OMR Engine reconstruído para layout industrial
import cv2  # type: ignore
import numpy as np  # type: ignore
import base64
import json
from pathlib import Path
import math
import time
import logging
from typing import Any, Dict, List, Optional, Union, cast

# Configuração de Logs e Diretórios de Debug
DEBUG_LOG_DIR = Path(__file__).parent / "debug_logs"
DEBUG_LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _circularity(cnt):
    """
    Calcula a circularidade de um contorno.
    1.0 = Círculo perfeito.
    """
    area = cv2.contourArea(cnt)
    perimeter = cv2.arcLength(cnt, True)
    if perimeter == 0:
        return 0
    return 4 * np.pi * area / (perimeter * perimeter)

class OMREngine:
    def __init__(self, default_version=1):
        self.default_version = default_version
        self.target_width = 1120
        self.target_height = 1600
        self.MIN_CONFIDENCE = 0.80
        self.layout_cache = {}
        
    def load_layout(self, layout_version: str = "v1"):
        # Normalizar: se for 1 virar v1
        version_str = str(layout_version)
        if version_str.isdigit() and not version_str.startswith("v"):
            version_str = f"v{version_str}"
            
        if version_str in self.layout_cache:
            return self.layout_cache[version_str]

        default_layout = {
            "version": "default",
            "warped_size": {"w": 1120, "h": 1600},
            "thresholds": {"marked": 0.20, "ambiguous": 0.10},
            "roi_size_pct_of_width": 0.028,
            "options": ["A", "B", "C", "D", "E"],
            "x_centers_pct": [0.245, 0.318, 0.392, 0.465, 0.538],
            "y_start_pct": 0.1079,
            "y_end_pct": 0.88,
            "num_questions": 26
        }

        p = Path(__file__).parent / f"layout_{version_str}.json"
        if not p.exists():
            if version_str != "v1":
                return self.load_layout("v1")
            return default_layout

        try:
            layout_data = json.loads(p.read_text(encoding="utf-8"))
            # Fusing with default to ensure no missing keys
            merged: Dict[str, Any] = {**default_layout, **layout_data}
            
            warped_size = cast(Dict[str, int], merged["warped_size"])
            self.target_width = int(warped_size["w"])
            self.target_height = int(warped_size["h"])

            self.layout_cache[version_str] = merged
            return merged
        except Exception as e:
            print(f"Erro ao carregar layout {version_str}: {e}")
            return default_layout
        
    def process_image(self, image_base64, num_questions=None, return_images=True, return_audit=True, layout_version=None):
        """
        Processa uma imagem de cartão-resposta seguindo as melhores práticas de OMR profissional.
        
        Retorna:
            dict: {
                "success": bool,
                "answers": list,  # Respostas detectadas
                "confidence_scores": list,  # Nível de confiança por questão (0-1)
                "question_status": list,  # "valid", "blank", "invalid", "ambiguous"
                "processed_image": str,  # Base64 da imagem retificada
                "audit_map": str,  # Base64 do mapa visual com bolhas destacadas
                "original_image": str,  # Base64 da imagem original (auditoria)
                "anchors_detected": bool,
                "qr_data": dict,  # Dados decodificados do QR Code {"aid": student_id, "gid": gabarito_id}
                "error": str  # Mensagem de erro, se houver
            }
        """
        try:
            # ===== 0. SELEÇÃO DE LAYOUT =====
            # Selecionar layout_version v1.1-a4-calibrated se não informado
            version_str = str(layout_version) if layout_version else "v1.1-a4-calibrated"
            current_layout = self.load_layout(version_str)
            
            # Fallback para num_questions do layout se não informado
            layout_nq = int(current_layout.get("num_questions", 25))
            if num_questions is None:
                num_questions = layout_nq

            # Atualizar dimensões baseadas no layout escolhido
            t_width = self.target_width
            t_height = self.target_height

            # ===== 1. AQUISIÇÃO DA IMAGEM =====
            img_data = base64.b64decode(image_base64.split(',')[-1])
            nparr = np.frombuffer(img_data, np.uint8)
            img_original = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_original is None:
                return {"success": False, "error": "Imagem vazia ou corrompida"}
            
            # Salvar original para auditoria
            _, buffer_orig = cv2.imencode('.jpg', img_original, [cv2.IMWRITE_JPEG_QUALITY, 85])
            original_base64 = base64.b64encode(buffer_orig).decode('utf-8')
            
            # Utiliza a imagem em formato original sem encolhê-la para não distorcer as âncoras
            img = img_original.copy()
            
            # ===== 1.1 DECODIFICAÇÃO DE IDENTIDADE (QR CODE) =====
            # Tentar decodificar o QR Code na imagem original para maior precisão
            qr_data = self.decode_qr(img_original)
            if not qr_data:
                # Tentar na imagem redimensionada se falhar
                qr_data = self.decode_qr(img)
            
            # ===== 2. PRÉ-PROCESSAMENTO AVANÇADO =====
            # 2.1 Converter para escala de cinza
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 2.2 Normalização de Iluminação (Flat-Field Correction)
            # 2.2 Pré-processamento Padronizado (Mesmo do Preview)
            # Aplicar CLAHE para equilibrar contraste local sem apagar as âncoras
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            gray_clahe = clahe.apply(gray)
            
            # 2.4 Aplicar Gaussian Blur para redução de ruído
            blurred = cv2.GaussianBlur(gray_clahe, (3, 3), 0)
            
            # 2.5 Binarização Adaptativa (Sincronizada com Preview)
            thresh = cv2.adaptiveThreshold(
                blurred, 255, 
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 
                31, 10
            )
            
            # ===== 3. DETECÇÃO ROBUSTA DE ÂNCORAS =====
            anchors = self.detect_anchors_robust(thresh, gray)
            
            if len(anchors) != 4:
                # Fallback: tentar com threshold global
                _, thresh_global = cv2.threshold(gray_clahe, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                anchors = self.detect_anchors_robust(thresh_global, gray)
            
            if len(anchors) != 4:
                error_msg = f"Erro de enquadramento: Detectadas {len(anchors)}/4 âncoras."
                self._log_debug_event(img_original, error_msg, {"anchors_found": len(anchors)})
                return {
                    "success": False,
                    "quality": "reject",
                    "error": f"{error_msg} Alinhe as 4 bolinhas pretas nos cantos.",
                    "anchors_found": len(anchors)
                }
            
            # ===== 4. CORREÇÃO DE PERSPECTIVA (HOMOGRAFIA) =====
            rect = self.order_points(np.array(anchors))
            
            tl, tr, br, bl = rect
            width_top = np.linalg.norm(tr - tl)
            width_bottom = np.linalg.norm(br - bl)
            
            if width_bottom == 0 or width_top == 0:
                return {
                    "success": False, 
                    "quality": "reject", 
                    "error": "Perspectiva inválida (divisão por zero). Refaça a foto."
                }
                
            ratio = width_top / width_bottom
            if ratio < 0.75 or ratio > 1.25:
                return {
                    "success": False, 
                    "quality": "reject",
                    "error": "Folha muito inclinada ou âncoras erradas detectadas localmente. Refaça a foto com o celular mais paralelo ao papel."
                }

            warped = self.four_point_transform(img, rect)
            
            # ===== 4.0 VALIDAÇÃO DE PERSPECTIVA EXTREMA =====
            # Se a câmera estava muito inclinada (ângulo > 60°), o ratio pode estar fora do esperado
            # Avisar ao usuário para tirar a foto mais paralela ao papel
            perspective_quality = self._validate_perspective_quality(rect, img.shape[:2])
            if perspective_quality["warning"]:
                logger.warning(f"Perspective warning: {perspective_quality['message']}")
            
            # Limpeza de memória imediata
            del img
            del gray
            del blurred
            del thresh
            del gray_clahe
            
            # ===== 4.1 VALIDAÇÃO PÓS-WARP =====
            # Verifica se os cantos da imagem retificada realmente contêm as âncoras pretas
            if not self.validate_warped_anchors(warped):
                return {
                    "success": False, 
                    "quality": "reject",
                    "error": "Alinhamento inválido (âncoras não confirmadas após retificação). Refaça a foto.", 
                    "anchors_found": 4
                }
            
            # ===== 5. LEITURA POR DENSIDADE DE PIXELS =====
            bubble_results = self.read_bubbles_by_density(warped, num_questions, version_str)
            
            # ===== 6. VALIDAÇÃO POR QUESTÃO =====
            validated_results = self.validate_questions(bubble_results, version_str)
            
            # ===== 7. DEFINICAO DA QUALIDADE DA LEITURA =====
            # Qualquer anomalia marca a prova para revisão humana invés de travar a API
            avg_conf = validated_results['avg_confidence']
            status_counts = validated_results['status_counts']
            
            review_reasons = []
            if status_counts.get("invalid", 0) > 0:
                review_reasons.append("invalid_marks")
            if status_counts.get("ambiguous", 0) > 2:
                review_reasons.append("too_many_ambiguous")
            if avg_conf < self.MIN_CONFIDENCE:
                review_reasons.append("low_confidence")
            
            # Adicionar aviso se perspectiva foi muito inclinada
            if perspective_quality.get("warning"):
                review_reasons.append("perspective_warning")
                
            needs_review = len(review_reasons) > 0
            quality = "review" if needs_review else "ok"
            
            # ===== 8. GERAÇÃO DE RETORNO OTIMIZADO E PADRONIZADO =====
            response = {
                "success": True,
                "quality": quality,
                "needs_review": needs_review,
                "review_reasons": review_reasons,
                "answers": validated_results['answers'],
                "confidence_scores": validated_results['confidence_scores'],
                "question_status": validated_results['status_list'],
                "status_counts": status_counts,
                "avg_confidence": avg_conf,
                "anchors_detected": True,
                "anchors_found": 4,
                "qr_data": qr_data,
                "perspective_warning": perspective_quality.get("message", "")
            }

            # ===== 9. SALVAR DIAGNÓSTICOS (DIAGNÓSTICOS PERMANENTES) =====
            try:
                # Criar pasta de auditoria estruturada
                audit_dir = DEBUG_LOG_DIR / "auditoria"
                audit_dir.mkdir(parents=True, exist_ok=True)
                
                timestamp = int(time.time())
                prefix = f"{timestamp}_{'OK' if quality == 'ok' else 'CHECK'}"
                
                # Salvar Original
                cv2.imwrite(str(audit_dir / f"{prefix}_0_orig.jpg"), img_original)
                
                # Salvar Warped (Retificada)
                cv2.imwrite(str(audit_dir / f"{prefix}_1_warped.jpg"), warped)
                
                # Salvar Audit (Com marcações)
                audit_map = self.generate_audit_map(warped, bubble_results, num_questions)
                cv2.imwrite(str(audit_dir / f"{prefix}_2_audit.jpg"), audit_map)
                
                # Salvar Metadados JSON
                with open(audit_dir / f"{prefix}_meta.json", 'w', encoding='utf-8') as f:
                    json.dump(response, f, indent=4, default=str)
                
                logger.info(f"Auditoria salva em {audit_dir} (prefixo: {prefix})")
            except Exception as e:
                logger.error(f"Erro ao salvar auditoria física: {e}")
            
            if return_images:
                _, buffer_warped = cv2.imencode('.jpg', warped, [cv2.IMWRITE_JPEG_QUALITY, 70])
                response["processed_image"] = f"data:image/jpeg;base64,{base64.b64encode(buffer_warped).decode('utf-8')}"
                
                # Original
                response["original_image"] = f"data:image/jpeg;base64,{original_base64}"
            
            if return_audit:
                # Se não geramos antes nos diagnósticos, gera agora
                if 'audit_map' not in locals():
                    audit_map = self.generate_audit_map(warped, bubble_results, num_questions)
                _, buffer_audit = cv2.imencode('.jpg', audit_map, [cv2.IMWRITE_JPEG_QUALITY, 70])
                response["audit_map"] = f"data:image/jpeg;base64,{base64.b64encode(buffer_audit).decode('utf-8')}"
            
            return response
            
        except Exception as e:
            # Tentar salvar log de erro crítico se tivermos a imagem original
            if 'img_original' in locals():
                self._log_debug_event(img_original, f"Erro Crítico: {str(e)}")
            return {"success": False, "error": f"Erro interno: {str(e)}"}

    def _log_debug_event(self, image, message, context=None):
        """
        Salva imagem e log de erro para diagnóstico técnico.
        """
        try:
            timestamp = int(time.time())
            event_id = f"fail_{timestamp}"
            
            # 1. Salvar Imagem
            img_path = DEBUG_LOG_DIR / f"{event_id}.jpg"
            cv2.imwrite(str(img_path), image)
            
            # 2. Salvar Log JSON
            log_path = DEBUG_LOG_DIR / f"{event_id}.json"
            log_data = {
                "timestamp": timestamp,
                "message": message,
                "context": context or {},
                "image_file": img_path.name
            }
            with open(log_path, 'w', encoding='utf-8') as f:
                json.dump(log_data, f, indent=4)
                
            print(f"DEBUG_LOG: Evento salvo em {img_path}")
        except Exception as log_err:
            print(f"Erro ao salvar debug log: {log_err}")

    def decode_qr(self, image):
        """
        Detecta e decodifica QR Codes na imagem usando OpenCV.
        """
        try:
            detector = cv2.QRCodeDetector()
            # O detector retorna: (data, bbox, straight_qrcode)
            data, bbox, _ = detector.detectAndDecode(image)
            
            if data:
                try:
                    return json.loads(data)
                except:
                    return data
            return None
        except Exception as e:
            print(f"Erro ao decodificar QR Code (OpenCV): {e}")
            return None
    
    def _validate_perspective_quality(self, rect_points, img_shape):
        """
        Valida a qualidade da perspectiva detectada.
        Avisa se a câmera estava em um ângulo muito extremo (muito de cima ou muito de lado).
        
        Retorna:
            dict: {
                "warning": bool,
                "message": str,
                "perspective_score": float (0-1, onde 1 é perspectiva ideal)
            }
        """
        try:
            tl, tr, br, bl = rect_points
            img_h, img_w = img_shape
            
            # Calcular os 4 lados do documento detectado
            top_edge_len = np.linalg.norm(tr - tl)      # Aresta superior
            bottom_edge_len = np.linalg.norm(br - bl)  # Aresta inferior
            left_edge_len = np.linalg.norm(bl - tl)    # Aresta esquerda
            right_edge_len = np.linalg.norm(br - tr)   # Aresta direita
            
            # Razão de compressão: quanto mais longe do ideal (1.0), mais inclinada a câmera
            # Se top_edge << bottom_edge, câmera está apontando de cima para baixo
            top_bottom_ratio = top_edge_len / (bottom_edge_len + 1e-6)
            left_right_ratio = left_edge_len / (right_edge_len + 1e-6)
            
            # Score de perspectiva: quão próxima a razão está de 1.0
            perspective_score = min(top_bottom_ratio, 1/top_bottom_ratio) * min(left_right_ratio, 1/left_right_ratio)
            
            # Avisar se perspectiva está muito distorcida
            warning = False
            message = "Perspectiva normal"
            
            if perspective_score < 0.65:
                warning = True
                message = "Câmera muito inclinada. Tire a foto mais paralela ao papel para melhor detecção."
            elif perspective_score < 0.80:
                warning = True
                message = "Câmera ligeiramente inclinada. Tente estar mais perpendicular ao papel."
            
            return {
                "warning": warning,
                "message": message,
                "perspective_score": perspective_score
            }
        except Exception as e:
            return {
                "warning": False,
                "message": f"Erro na validação de perspectiva: {str(e)}",
                "perspective_score": 0.0
            }

    
    def detect_anchors_robust(self, thresh, gray):
        """
        Versão Profissional: Suporta âncoras circulares (legado) e quadradas (novas).
        """
        H, W = thresh.shape[:2]
        # Usar adaptiveThreshold no lugar de um valor duro de 70 para garantir suporte a múltiplas iluminações
        strict_thresh = cv2.adaptiveThreshold(
            gray, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 
            31, 10
        )
        
        contours, _ = cv2.findContours(strict_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < (H * W * 0.0015) or area > (H * W * 0.03):
                continue
            
            # Filtro de Forma: Circularidade ou Quadrado
            circ = _circularity(cnt)
            
            # Checar se é aproximadamente um retângulo/quadrado
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            is_square = len(approx) == 4 and cv2.isContourConvex(approx)

            # Aceita se for redondo o suficiente OU um quadrado robusto
            if circ < 0.50 and not is_square: # Reduzido circ de 0.65 para 0.50 para tolerar estiramento da câmera
                continue

            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            
            # Priorizar o centro do bounding box para quadrados
            if is_square:
                x, y, w, h = cv2.boundingRect(cnt)
                cX, cY = x + w//2, y + h//2
                
            # Margem relaxada: as âncoras agora podem estar mais longe das bordas 
            # já que cercam apenas o gabarito e não a folha toda.
            # Margem mais rigorosa para reduzir falsos positivos (0.28 industrial)
            margin = 0.28 
            valid = (
                (cX < W*margin and cY < H*margin) or
                (cX > W*(1-margin) and cY < H*margin) or
                (cX > W*(1-margin) and cY > H*(1-margin)) or
                (cX < W*margin and cY > H*(1-margin))
            )
            if not valid:
                continue

            # Filtros Robustos Extras
            # 1. Aspect Ratio (Quadrados/Círculos devem ser próximos a 1:1)
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / float(h)
            if aspect_ratio < 0.7 or aspect_ratio > 1.4:
                continue
                
            # 2. Densidade Interna (Deve ser bem preto)
            # Criamos uma máscara local para o ROI da âncora
            roi_mask = np.zeros(strict_thresh.shape, dtype=np.uint8)
            cv2.drawContours(roi_mask, [cnt], -1, 255, -1)
            mean_val = cv2.mean(gray, mask=roi_mask)[0]
            # O fundo é ~200+, preto é <100. Se a média for >110, não é uma âncora sólida
            if mean_val > 110:
                continue

            # 3. Distância Euclidiana ao Canto Esperado (Score Bonus)
            # Definir cantos alvos
            targets = [ (0,0), (W,0), (W,H), (0,H) ]
            dists = [np.sqrt((cX-tx)**2 + (cY-ty)**2) for tx, ty in targets]
            min_dist = min(dists)
            dist_score = 1.0 / (1.0 + min_dist/100.0) # Bonus que decai com a distância

            candidates.append({
                "cx": cX, 
                "cy": cY, 
                "area": area, 
                "score": (max(circ, 0.9 if is_square else 0) * 0.7) + (dist_score * 0.3)
            })

        if len(candidates) < 4:
            return []

        quadrantes = [
            [c for c in candidates if c['cx'] < W/2 and c['cy'] < H/2], # TL
            [c for c in candidates if c['cx'] > W/2 and c['cy'] < H/2], # TR
            [c for c in candidates if c['cx'] > W/2 and c['cy'] > H/2], # BR
            [c for c in candidates if c['cx'] < W/2 and c['cy'] > H/2]  # BL
        ]

        final_anchors = []
        for pool in quadrantes:
            if not pool:
                return []
            # Pega o que tem melhor "score" (circularidade ou presença de quadrado)
            best = max(pool, key=lambda x: x['score'])
            final_anchors.append((best['cx'], best['cy']))

        # Tentar detectar marcador central (opcional, para correção de barril/coxim)
        center_pool = [c for c in candidates if W*0.4 < c['cx'] < W*0.6 and H*0.4 < c['cy'] < H*0.6]
        if center_pool:
            best_center = max(center_pool, key=lambda x: x['score'])
            # Por enquanto apenas logamos ou guardamos para futuras correções de 2ª ordem
            logger.debug(f"Center marker detected at {best_center['cx']}, {best_center['cy']}")

        return final_anchors

    def detect_anchors_only(self, image_base64):
        """
        Detecta âncoras rapidamente para feedback em tempo real (Modo Alinhamento).
        Preserva a proporção (aspect ratio) da imagem e retorna coordenadas RELATIVAS (0.0 a 1.0),
        permitindo ao Frontend desenhar o polígono SVG perfeitamente por cima do videoRef.
        """
        try:
            img_data = base64.b64decode(image_base64.split(',')[-1])
            np_img = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

            if image is None:
                return {"success": False, "error": "Imagem inválida"}
            
            H, W = image.shape[:2]

            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

            anchors = self.detect_anchors_robust(thresh, gray)
            
            if len(anchors) == 4:
                # Retornar coordenadas relativas (0 a 1)
                rel_anchors = []
                for (x, y) in anchors:
                    rel_anchors.append([round(x / W, 4), round(y / H, 4)])
                
                # Tentar decodificar QR Code para feedback de identidade (Instant Identity)
                qr_data = self.decode_qr(image)
                
                return {
                    "success": True,
                    "anchors_found": 4,
                    "anchors": rel_anchors,
                    "confidence": 0.95,
                    "qr_data": qr_data
                }
            
            return {
                "success": False, 
                "anchors_found": len(anchors), 
                "confidence": 0.0,
                "anchors": [[round(x / W, 4), round(y / H, 4)] for (x, y) in (anchors if anchors else [])]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _fallback_pick_anchors_by_nearest_corners(self, pts, W, H):
        targets = [(0,0),(int(W),0),(int(W),int(H)),(0,int(H))]
        final = []
        used = set()
        # Casting pts to Any to allow robust indexing in older linter versions
        pts_indexed = cast(Any, pts)
        for tx, ty in targets:
            best_i, best_d = -1, float("inf")
            for i, p in enumerate(pts_indexed):
                if i in used: 
                    continue
                x, y = float(p[0]), float(p[1])
                d = (x - float(tx))**2 + (y - float(ty))**2
                if d < best_d:
                    best_d, best_i = d, i
            if best_i >= 0:
                used.add(best_i)
                final.append(pts_indexed[best_i])  # type: ignore
        return final


    def validate_warped_anchors(self, warped):
        """Validação secundária: as âncoras devem estar nos cantos do warped."""
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Verificar ROIs pequenos nos 4 cantos
        roi_size = 40
        corners = [
            thresh[0:roi_size, 0:roi_size], # TL
            thresh[0:roi_size, -roi_size:], # TR
            thresh[-roi_size:, -roi_size:], # BR
            thresh[-roi_size:, 0:roi_size]  # BL
        ]
        
        for i, roi in enumerate(corners):
            density = cv2.countNonZero(roi) / float(roi.size)
            if density < 0.3: # Exige pelo menos 30% de preto no canto
                return False
        return True
    
    def order_points(self, pts):
        """Ordena pontos: TL, TR, BR, BL (sentido horário) de forma robusta e industrial.
        Combina soma/diferença (clássico) com ordenação angular para máxima robustez.
        """
        # 1. Soma e Diferença (Melhor para TV/Monitores/Fotos Planas)
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1)
        
        # TL tem menor soma, BR tem maior soma
        tl_idx = np.argmin(s)
        br_idx = np.argmax(s)
        # TR tem menor diferença, BL tem maior diferença
        tr_idx = np.argmin(diff)
        bl_idx = np.argmax(diff)
        
        rect = np.array([pts[tl_idx], pts[tr_idx], pts[br_idx], pts[bl_idx]], dtype="float32")
        
        # 2. VALIDAÇÃO GEOMÉTRICA (Check de Sanidade)
        # Se os índices colidirem, ou a área for muito pequena, fallback para angular
        if len(set([tl_idx, tr_idx, br_idx, bl_idx])) < 4:
            center = np.mean(pts, axis=0)
            angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
            pts_sorted = pts[np.argsort(angles)]
            # Alinhar TL ao primeiro quadrante
            tl_cand = np.argmin([np.linalg.norm(p - [0,0]) for p in pts_sorted])
            rect = np.roll(pts_sorted, -tl_cand, axis=0)

        return np.array(rect, dtype="float32")
    
    def four_point_transform(self, image, rect):
        """Aplica transformação de perspectiva (homografia) e valida orientação resultante"""
        dst = np.array([
            [0, 0],
            [self.target_width - 1, 0],
            [self.target_width - 1, self.target_height - 1],
            [0, self.target_height - 1]
        ], dtype="float32")
        
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (self.target_width, self.target_height))
        
        # VALIDAÇÃO DE ORIENTAÇÃO: Se a imagem resultante estiver muito "larga" (landscape),
        # pode indicar que a transformação foi aplicada com pontos em ordem errada.
        # Isso é comum quando a câmera está muito inclinada de cima para baixo.
        # 
        # Nota: target_width=1120 e target_height=1600, então é sempre retrato por design.
        # Se mesmo assim a imagem parecer "errada", validamos checando as âncoras.
        
        return warped

    def _masked_ratio(self, roi):
        """
        Mede a densidade de pixels pretos usando uma máscara circular perfeita 
        para o centro (bolha) e um anel ao redor (fundo/borda), ignorando 
        os cantos quadrados do ROI que não fazem parte da bolha.
        """
        H, W = roi.shape[:2]
        center = (W // 2, H // 2)
        radius_inner = int(min(W, H) * 0.35)  # 70% do tamanho para o disco central
        radius_outer = int(min(W, H) * 0.48)  # Anel quase tocando a borda
        
        # Máscara do disco central (onde o aluno pinta)
        mask_inner = np.zeros((H, W), dtype=np.uint8)
        cv2.circle(mask_inner, center, radius_inner, 255, -1)
        
        # Máscara do anel de fundo (para medir sujeira/borracha)
        mask_outer = np.zeros((H, W), dtype=np.uint8)
        cv2.circle(mask_outer, center, radius_outer, 255, -1)
        cv2.circle(mask_outer, center, radius_inner + 2, 0, -1) # Furo no meio
        
        # Contar pixels na imagem binarizada usando as máscaras
        inner_pixels = cv2.countNonZero(cv2.bitwise_and(roi, mask_inner))
        inner_area = cv2.countNonZero(mask_inner)
        
        outer_pixels = cv2.countNonZero(cv2.bitwise_and(roi, mask_outer))
        outer_area = cv2.countNonZero(mask_outer)
        
        fill_ratio = inner_pixels / float(inner_area) if inner_area > 0 else 0.0
        bg_ratio = outer_pixels / float(outer_area) if outer_area > 0 else 0.0
        
        return fill_ratio, bg_ratio
    
    
    def _get_contrast_calibration(self, warped):
        """
        Amostra a barra de calibração lateral (deve estar em x=~4mm a 7mm)
        para determinar o nível real de preto e branco e ajustar sensibilidade.
        """
        try:
            H, W = warped.shape[:2]
            # Barra está em ~2mm de 180mm total da largura do wrapper
            x1 = int(W * (2.0/180.0))
            x2 = int(W * (4.0/180.0))
            roi_strip = warped[int(H*0.2):int(H*0.8), x1:x2]
            gray_strip = cv2.cvtColor(roi_strip, cv2.COLOR_BGR2GRAY)
            
            min_val, max_val, _, _ = cv2.minMaxLoc(gray_strip)
            # min_val representa o preto mais denso na imagem
            # max_val representa o fundo branco próximo
            return min_val, max_val
        except:
            return 0, 255

    def read_bubbles_by_density(self, warped, num_questions, layout_version="v1"):
        """
        Lê bolhas usando análise de densidade de pixels baseada no layout JSON.
        """
        layout = self.load_layout(layout_version)
        if not layout or not isinstance(layout, dict):
            return []
        
        layout_dict = cast(Dict[str, Any], layout)

        thr = cast(Dict[str, float], layout_dict.get("thresholds", {}))
        marked_thr = float(thr.get("marked", 0.20))
        amb_thr = float(thr.get("ambiguous", 0.10))

        options = cast(List[str], layout_dict.get("options", ["A", "B", "C", "D", "E"]))
        x_centers_pct = cast(List[float], layout_dict.get("x_centers_pct", [0.245, 0.318, 0.392, 0.465, 0.538]))
        num_questions_raw = layout.get("num_questions", num_questions)
        q_count: int = int(num_questions_raw) if num_questions_raw is not None else 26

        num_cols = int(layout.get("num_columns", 1))
        num_rows_val = math.ceil(q_count / num_cols)
        
        # O gerador industrial usa passo fixo de 11mm em um wrapper de 190mm
        y_step_pct = float(layout.get("y_step_pct_fixed", 0.0579))
        y_start_pct = float(layout.get("y_start_pct_fixed", 0.1079))
        
        roi_size = int(self.target_width * float(layout.get("roi_size_pct_of_width", 0.028)))
        x_offsets_pct = layout.get("x_offsets_pct", [0.0])
        
        # 1. Calibração de contraste via barra lateral
        black_lv, white_lv = self._get_contrast_calibration(warped)
        logger.debug(f"Contrast Calib: Black={black_lv}, White={white_lv}")

        # Binarizar a imagem retificada para leitura das bolhas
        gray_warped = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        # Se detectamos um preto muito claro (ex: scanner/luz ruim), usamos threshold manual dinâmico
        if black_lv > 70:
            # Imagem está muito lavada, forçamos threshold mais agressivo
            thresh_val = (black_lv + white_lv) // 2
            _, thresh = cv2.threshold(gray_warped, thresh_val, 255, cv2.THRESH_BINARY_INV)
        else:
            _, thresh = cv2.threshold(gray_warped, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        thresh_indexed = cast(Any, thresh)
        results: List[Dict[str, Any]] = []
        
        # O gerador do frontend (GabaritoTemplate) usa colunas verticais (blocos)
        # Isso significa que ele preenche Bloco 1: Q1-Q7 | Bloco 2: Q8-Q14...
        # Invertemos a ordem: Column -> Row
        q_idx: int = 0
        num_cols_val = int(cast(Union[int, float], num_cols))
        num_rows_val = int(cast(Union[int, float], num_rows_val))
        num_q_val = int(cast(Union[int, float], q_count))

        for col in range(num_cols_val):
            x_offset = float(x_offsets_pct[col]) * float(self.target_width)
            
            for row in range(num_rows_val):
                if int(q_idx) >= int(num_q_val):
                    break
                
                # Cálculo de Y usando passo fixo (Industrial)
                y_center_f = (y_start_pct + (float(row) * y_step_pct)) * float(self.target_height)
                y_center = float(y_center_f)
                bubbles_data: List[Dict[str, Any]] = []
                
                for j, x_pct_rel in enumerate(x_centers_pct):
                    # Coordenada X absoluta = x_offset (da coluna) + (x_pct_rel * largura)
                    x_center = x_offset + (float(x_pct_rel) * float(self.target_width))
                    
                    # Definir ROI
                    x1 = max(0, int(x_center - float(roi_size)/2))
                    y1 = max(0, int(y_center - float(roi_size)/2))
                    x2 = min(int(self.target_width), x1 + int(roi_size))
                    y2 = min(int(self.target_height), y1 + int(roi_size))
                    
                    # Cast thresh to Any to allow slicing without Unknown errors
                    thresh_img = cast(Any, thresh)
                    roi = thresh_img[y1:y2, x1:x2]
                    
                    fill_ratio, bg_ratio = self._masked_ratio(roi)
                    option_val = str(cast(List[str], options)[j])
                    bubbles_data.append({
                        'option': option_val,
                        'score': float(fill_ratio),
                        'bg_score': float(bg_ratio),
                        'coords': [int(x1), int(y1), int(x2), int(y2)]
                    })
                
                results.append({
                    'question': q_idx + 1,  # type: ignore
                    'bubbles': bubbles_data
                })
                q_idx += 1  # type: ignore
        
        return results
    
    def validate_questions(self, bubble_results: List[Dict[str, Any]], layout_version="v1"):
        """
        Lógica de Densidade Relativa por Score e Margem.
        Compara o Score da opção mais pintada (Top 1) com a segunda mais pintada (Top 2).
        Anota final_status/final_conf/final_index na question_data para o audit_map.
        """
        layout = self.load_layout(layout_version)
        layout_dict = cast(Dict[str, Any], layout)
        thr = cast(Dict[str, Any], layout_dict.get("thresholds", {}))
        
        marked_thr = float(thr.get("marked", 0.15))   # Acima disso, consideramos que tem tinta real
        amb_thr = float(thr.get("ambiguous", 0.08))      # Abaixo disso, é sujeira ou nada (em branco)
        margin_thr = 0.06   # Diferença mínima entre Top 1 e Top 2 para não ser ambíguo

        answers: List[Optional[str]] = []
        confidence_scores: List[float] = []
        status_list: List[str] = []
        status_counts = {"valid": 0, "blank": 0, "invalid": 0, "ambiguous": 0}

        for question_data in bubble_results:
            bubbles = question_data['bubbles']
            
            # 1. ANALISAR TOP 1 E TOP 2 COM SINAL ÚTIL DO BG_SCORE
            # bg_score mede sujeira/borda perto da bolha. Bolha real tem bg_score baixo.
            # Se bg_score for alto (ex > 0.10), penalizamos o score da bolha
            def adjusted_score(b):
                penalty = max(0.0, b['bg_score'] - 0.05) * 0.5
                return max(0.0, b['score'] - penalty)

            # Ordenar bolhas por score ajustado
            sorted_bubbles = sorted(bubbles, key=adjusted_score, reverse=True)
            
            top1_b = sorted_bubbles[0]
            top2_b = sorted_bubbles[1] if len(sorted_bubbles) > 1 else None
            
            t1_score = adjusted_score(top1_b)
            t2_score = adjusted_score(top2_b) if top2_b else 0.0
            
            margin = t1_score - t2_score
            
            # 1. Checar se está em branco (Mesmo o Top 1 é irrelevante)
            if t1_score < amb_thr:
                status = "blank"
                ans = None
                conf = 1.0 - (t1_score / amb_thr)
                final_idx = None
            
            # 2. Checar múltiplas marcações reais
            # Para ser inválido, t2_score deve ser alto E o margin deve ser pequeno
            # Se margin for grande (> 0.10), provavelmente t2 é apenas sujeira
            elif t2_score >= marked_thr and margin < 0.10:
                status = "invalid"
                ans = None
                conf = 0.0
                final_idx = None
                
            # 3. Checar ambiguidade
            elif t2_score >= amb_thr and margin < margin_thr:
                status = "ambiguous"
                ans = top1_b['option']
                conf = max(0.0, margin / margin_thr)
                final_idx = bubbles.index(top1_b)
                
            # 4. Válido e claro
            else:
                status = "valid"
                ans = top1_b['option']
                conf = min(1.0, margin / (margin_thr * 2.5)) if margin_thr > 0 else 1.0
                final_idx = bubbles.index(top1_b)

            # Anotar na question_data para o audit_map usar
            question_data["final_status"] = status
            question_data["final_index"] = final_idx
            question_data["final_conf"] = conf

            status_list.append(status)
            status_counts[status] += 1
            answers.append(ans)
            confidence_scores.append(conf)

        return {
            'answers': answers,
            'confidence_scores': confidence_scores,
            'status_list': status_list,
            'status_counts': status_counts,
            'avg_confidence': float(np.mean(confidence_scores)) if confidence_scores else 0.0
        }
    
    def generate_audit_map(self, warped, bubble_results: List[Dict[str, Any]], num_questions):
        """
        Gera mapa visual destacando as bolhas detectadas.
        Usa final_status anotado pelo validate_questions para cores consistentes.
        """
        audit_img = warped.copy()
        
        for question_data in bubble_results:
            status = str(question_data.get("final_status", ""))
            final_idx_val = question_data.get("final_index")
            final_idx = cast(Optional[int], final_idx_val)
            conf = float(question_data.get("final_conf", 0.0))
            
            if status == "blank":
                for bubble in question_data['bubbles']:
                    x1, y1, x2, y2 = bubble['coords']
                    cv2.rectangle(audit_img, (x1, y1), (x2, y2), (255, 100, 0), 2)
            
            elif status == "invalid":
                # Se for inválido, pinta de vermelho as bolhas que atingiram o limiar "marked_thr" de ambiguidade (as múltiplas marcações)
                marked_bubbles = [b for b in question_data['bubbles'] if b.get('score', 0) > 0.15]
                for bubble in marked_bubbles:
                    x1, y1, x2, y2 = bubble['coords']
                    cv2.rectangle(audit_img, (x1, y1), (x2, y2), (0, 0, 255), 3)
            
            elif status in ("valid", "ambiguous") and final_idx is not None:
                bubble = question_data['bubbles'][final_idx]
                x1, y1, x2, y2 = bubble['coords']
                
                if status == "valid":
                    cv2.rectangle(audit_img, (x1, y1), (x2, y2), (0, 255, 0), 3)
                else:
                    cv2.rectangle(audit_img, (x1, y1), (x2, y2), (0, 255, 255), 3)
            
            else:
                # Fallback para questões não validadas (ex: bubble_results sem validate)
                marked_bubbles = [b for b in question_data['bubbles'] if b.get('score', 0) > 0.15]
                for bubble in marked_bubbles:
                    x1, y1, x2, y2 = bubble['coords']
                    cv2.rectangle(audit_img, (x1, y1), (x2, y2), (0, 255, 0), 3)
        
        return audit_img
