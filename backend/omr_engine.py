import json
import os
import cv2
import numpy as np
import base64
import time
import math
from pathlib import Path

def _circularity(cnt):
    peri = cv2.arcLength(cnt, True)
    if peri <= 0:
        return 0.0
    area = cv2.contourArea(cnt)
    return (4.0 * math.pi * area) / (peri * peri)

# Pasta para logs de debug (imagens de falha)
DEBUG_LOG_DIR = Path(__file__).parent / "debug_logs"
if not DEBUG_LOG_DIR.exists():
    DEBUG_LOG_DIR.mkdir(parents=True, exist_ok=True)

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
            "roi_size_pct_of_width": 0.030,
            "options": ["A", "B", "C", "D", "E"],
            "x_centers_pct": [0.245, 0.318, 0.392, 0.465, 0.538],
            "y_start_pct": 0.21,
            "y_end_pct": 0.88,
            "num_questions": 25
        }

        p = Path(__file__).parent / f"layout_{version_str}.json"
        if not p.exists():
            if version_str != "v1":
                return self.load_layout("v1")
            return default_layout

        try:
            layout = json.loads(p.read_text(encoding="utf-8"))
            # Fusing with default to ensure no missing keys
            merged = {**default_layout, **layout}
            
            self.target_width = merged["warped_size"]["w"]
            self.target_height = merged["warped_size"]["h"]

            self.layout_cache[version_str] = merged
            return merged
        except Exception as e:
            print(f"Erro ao carregar layout {version_str}: {e}")
            return default_layout
        
    def process_image(self, image_base64, num_questions=10, return_images=True, return_audit=True, layout_version=None):
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
            version_str = str(layout_version) if layout_version else "v1"
            current_layout = self.load_layout(version_str)
            
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
            # Remove sombras e variações graduais de luz
            dilated_img = cv2.dilate(gray, np.ones((7, 7), np.uint8))
            bg_img = cv2.medianBlur(dilated_img, 21)
            diff_img = cv2.absdiff(gray, bg_img)
            norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            
            # 2.3 Aplicar CLAHE (Contrast Limited Adaptive Histogram Equalization) para detalhes locais
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            gray_clahe = clahe.apply(norm_img)
            
            # 2.4 Aplicar Gaussian Blur para redução de ruído
            blurred = cv2.GaussianBlur(gray_clahe, (3, 3), 0)
            
            # 2.5 Binarização Adaptativa
            thresh = cv2.adaptiveThreshold(
                blurred, 255, 
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 
                21, 5
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
            
            # Limpeza de memória imediata
            del img
            del gray
            del blurred
            del thresh
            del norm_img
            del gray_clahe
            
            # ===== 4.1 VALIDAÇÃO PÓS-WARP =====
            ratios = self._corner_black_ratio(warped)
            if sum(1 for x in ratios if x > 0.10) < 3:
                return {
                    "success": False, 
                    "quality": "reject",
                    "error": "Alinhamento inválido (cantos não conferem). Refaça a foto.", 
                    "anchors_found": 4
                }
            
            # ===== 5. LEITURA POR DENSIDADE DE PIXELS =====
            bubble_results = self.read_bubbles_by_density(warped, num_questions, version_str)
            
            # ===== 6. VALIDAÇÃO POR QUESTÃO =====
            validated_results = self.validate_questions(bubble_results)
            
            # ===== 7. DEFINICAO DA QUALIDADE DA LEITURA =====
            # Qualquer anomalia marca a prova para revisão humana invés de travar a API
            avg_conf = validated_results['avg_confidence']
            status_counts = validated_results['status_counts']
            
            review_reasons = []
            if status_counts.get("invalid", 0) > 0:
                review_reasons.append("invalid_marks")
            if status_counts.get("ambiguous", 0) > 2:
                review_reasons.append("too_many_ambiguous")
            if avg_conf < 0.75:
                review_reasons.append("low_confidence")
                
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
                "qr_data": qr_data
            }
            
            if return_images:
                _, buffer_warped = cv2.imencode('.jpg', warped, [cv2.IMWRITE_JPEG_QUALITY, 70])
                response["processed_image"] = f"data:image/jpg;base64,{base64.b64encode(buffer_warped).decode('utf-8')}"
                
                # Original só manda se explicitamente pedido (vou manter fixo True por enquanto para compatibilidade se o app não mandar o flag)
                response["original_image"] = f"data:image/jpg;base64,{original_base64}"
            
            if return_audit:
                audit_map = self.generate_audit_map(warped, bubble_results, num_questions)
                _, buffer_audit = cv2.imencode('.jpg', audit_map, [cv2.IMWRITE_JPEG_QUALITY, 70])
                response["audit_map"] = f"data:image/jpg;base64,{base64.b64encode(buffer_audit).decode('utf-8')}"
            
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
                
            margin = 0.18
            valid = (
                (cX < W*margin and cY < H*margin) or
                (cX > W*(1-margin) and cY < H*margin) or
                (cX > W*(1-margin) and cY > H*(1-margin)) or
                (cX < W*margin and cY > H*(1-margin))
            )
            if not valid:
                continue

            candidates.append({"cx": cX, "cy": cY, "area": area, "score": max(circ, 0.9 if is_square else 0)})

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
                
                return {
                    "success": True,
                    "anchors_found": 4,
                    "anchors": rel_anchors,
                    "confidence": 0.95
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
        targets = [(0,0),(W,0),(W,H),(0,H)]
        final = []
        used = set()
        for tx, ty in targets:
            best_i, best_d = -1, float("inf")
            for i, (x,y) in enumerate(pts):
                if i in used: 
                    continue
                d = (x-tx)**2 + (y-ty)**2
                if d < best_d:
                    best_d, best_i = d, i
            if best_i >= 0:
                used.add(best_i)
                final.append(pts[best_i])
        return final

    def _corner_black_ratio(self, warped):
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        H, W = bw.shape[:2]
        s = int(min(W, H) * 0.045)  # ROI ~4.5% do menor lado para maior precisão (âncora 7mm)
        rois = [
            bw[0:s, 0:s],                 # TL
            bw[0:s, W-s:W],               # TR
            bw[H-s:H, W-s:W],             # BR
            bw[H-s:H, 0:s],               # BL
        ]
        ratios = []
        for r in rois:
            ratios.append(cv2.countNonZero(r) / float(r.size))
        return ratios

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
        """Ordena pontos: TL, TR, BR, BL (sentido horário) de forma robusta a inclinações
        Garante que a aresta entre os 2 primeiros pontos seja uma aresta curta (Topo do retrato).
        """
        # 1. Obter o centro geométrico
        center = np.mean(pts, axis=0)
        
        # 2. Ordenar pontos em sentido horário usando atan2
        angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
        pts_sorted = pts[np.argsort(angles)]
        
        # 3. Descobrir qual aresta é a mais longa
        distances = []
        for i in range(4):
            p_next = pts_sorted[(i + 1) % 4]
            dist = np.linalg.norm(pts_sorted[i] - p_next)
            distances.append(dist)
            
        # 4. Aresta 0 é pts_sorted[0] -> pts_sorted[1]
        # Queremos forçar o formato Retrato, ou seja, Aresta Superior (0) deve ser menor que Lateral (1)
        if distances[0] > distances[1]:
            # Aresta 0 é longa, então rotaciona o array em 1 para que a aresta 0 passe a ser a curta (Top)
            pts_sorted = np.roll(pts_sorted, -1, axis=0)
            
        return np.array(pts_sorted, dtype="float32")
    
    def four_point_transform(self, image, rect):
        """Aplica transformação de perspectiva (homografia)"""
        dst = np.array([
            [0, 0],
            [self.target_width - 1, 0],
            [self.target_width - 1, self.target_height - 1],
            [0, self.target_height - 1]
        ], dtype="float32")
        
        M = cv2.getPerspectiveTransform(rect, dst)
        return cv2.warpPerspective(image, M, (self.target_width, self.target_height))

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
    
    
    def read_bubbles_by_density(self, warped, num_questions, layout_version="v1"):
        """
        Lê bolhas usando análise de densidade de pixels baseada no layout JSON.
        """
        layout = self.load_layout(layout_version)
        if not layout:
            return []

        marked_thr = float(layout["thresholds"]["marked"])
        amb_thr = float(layout["thresholds"]["ambiguous"])

        options = layout["options"]
        x_centers_pct = layout["x_centers_pct"]
        y_start_pct = float(layout["y_start_pct"])
        y_end_pct = float(layout["y_end_pct"])

        # usa num_questions do request, mas você pode travar no layout se quiser
        y_step_pct = (y_end_pct - y_start_pct) / float(num_questions)
        roi_size = int(self.target_width * float(layout["roi_size_pct_of_width"]))

        # Pré-processar imagem warped
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        gray_clahe = clahe.apply(gray)
        blurred = cv2.GaussianBlur(gray_clahe, (3, 3), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            25, 10
        )
        
        results = []
        for i in range(num_questions):
            y_center = (y_start_pct + (i * y_step_pct) + (y_step_pct / 2.0)) * self.target_height
            bubbles_data = []
            
            for j, x_pct in enumerate(x_centers_pct):
                x_center = x_pct * self.target_width
                
                # Definir ROI
                x1 = max(0, int(x_center - roi_size/2))
                y1 = max(0, int(y_center - roi_size/2))
                x2 = min(self.target_width, x1 + roi_size)
                y2 = min(self.target_height, y1 + roi_size)
                
                roi = thresh[y1:y2, x1:x2]
                if roi.size == 0:
                    fill_ratio, bg_ratio = 0.0, 0.0
                else:
                    fill_ratio, bg_ratio = self._masked_ratio(roi)
                
                # Score normalizado pune bolhas muito rascunhadas/apagadas
                score = max(0.0, fill_ratio - bg_ratio)
                
                bubbles_data.append({
                    'option': options[j],
                    'density': fill_ratio, # Mantido para debug/compatibilidade visual
                    'fill_ratio': fill_ratio,
                    'bg_ratio': bg_ratio,
                    'score': score,
                    'coords': (x1, y1, x2, y2)
                })
            
            results.append({
                'question_idx': i,
                'bubbles': bubbles_data
            })
        
        return results
    
    def validate_questions(self, bubble_results):
        """
        Lógica de Densidade Relativa por Score e Margem.
        Compara o Score da opção mais pintada (Top 1) com a segunda mais pintada (Top 2).
        Anota final_status/final_conf/final_index na question_data para o audit_map.
        """
        # Para simplificar, vou extrair regras do engine (podem vir do JSON de layout futuramente)
        marked_thr = 0.15   # Acima disso, consideramos que tem tinta real
        amb_thr = 0.08      # Abaixo disso, é sujeira ou nada (em branco)
        margin_thr = 0.06   # Diferença mínima entre Top 1 e Top 2 para não ser ambíguo

        for question_data in bubble_results:
            bubbles = question_data['bubbles']
            
            # Ordenar bolhas por score do maior para o menor
            sorted_bubbles = sorted(bubbles, key=lambda b: b['score'], reverse=True)
            
            top1_b = sorted_bubbles[0]
            top2_b = sorted_bubbles[1] if len(sorted_bubbles) > 1 else None
            
            top1_score = top1_b['score']
            top2_score = top2_b['score'] if top2_b else 0.0
            
            margin = top1_score - top2_score
            
            # 1. Checar se está em branco (o Top 1 é tão fraco que não chega nem a rascunho)
            if top1_score < amb_thr:
                status = "blank"
                ans = None
                conf = 0.0
                final_idx = None
            
            # 2. Checar múltiplas marcações reais (Top 1 e Top 2 estão pintados de verdade)
            elif top2_score >= marked_thr:
                status = "invalid"  # Aluno pintou duas claras
                ans = None
                conf = 0.0
                final_idx = None
                
            # 3. Checar ambiguidade (Top 1 e Top 2 estão muito próximos, ex: borrado)
            elif top2_score >= amb_thr and margin < margin_thr:
                status = "ambiguous"
                ans = top1_b['option']
                # Tenta ajudar a revisão fornecendo a opção mais provável
                conf = max(0.0, margin / margin_thr) # Confiança proporcional à margem
                final_idx = bubbles.index(top1_b)
                
            # 4. Válido e claro (Top 1 se destaca)
            else:
                status = "valid"
                ans = top1_b['option']
                # Se a margem for maior que 3x a margem mínima, confiança é 1.0 (perfeita)
                conf = min(1.0, margin / (margin_thr * 3)) if margin_thr > 0 else 1.0
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
            'avg_confidence': np.mean(confidence_scores) if confidence_scores else 0.0
        }
    
    def generate_audit_map(self, warped, bubble_results, num_questions):
        """
        Gera mapa visual destacando as bolhas detectadas.
        Usa final_status anotado pelo validate_questions para cores consistentes.
        
        Cores:
        - Verde: bolha marcada com alta confiança
        - Amarelo: bolha marcada com baixa confiança (ambígua)
        - Vermelho: múltiplas marcações (inválida)
        - Azul: questão em branco
        """
        audit_img = warped.copy()
        
        for question_data in bubble_results:
            status = question_data.get("final_status")
            final_idx = question_data.get("final_index")
            conf = question_data.get("final_conf", 0)
            
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
