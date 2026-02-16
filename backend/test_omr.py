import cv2
import numpy as np
import json
import os
from omr_engine import OMREngine

def test_omr_engine():
    engine = OMREngine()
    
    print("=== OMR Engine Test Script ===")
    
    # Criar uma imagem sintética para teste se não houver uma real
    test_img_path = "test_sample.png"
    if not os.path.exists(test_img_path):
        print("Criando imagem de teste sintética...")
        img = np.ones((1000, 700, 3), dtype=np.uint8) * 255
        
        # Desenhar marcadores (fiducials)
        size = 40
        cv2.rectangle(img, (20, 20), (20+size, 20+size), (0, 0, 0), -1)
        cv2.rectangle(img, (640, 20), (640+size, 20+size), (0, 0, 0), -1)
        cv2.rectangle(img, (20, 940), (20+size, 940+size), (0, 0, 0), -1)
        cv2.rectangle(img, (640, 940), (640+size, 940+size), (0, 0, 0), -1)
        
        # Simular QR Code (apenas um quadrado preto para o teste de OCR/QR se ignorarmos o conteúdo)
        cv2.rectangle(img, (300, 40), (400, 140), (0, 0, 0), 2)
        cv2.putText(img, "QR", (330, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,0), 2)
        
        cv2.imwrite(test_img_path, img)
    
    # Processar
    print(f"Processando {test_img_path}...")
    try:
        # Codificar imagem em base64 para simular API
        with open(test_img_path, "rb") as image_file:
            import base64
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            img_b64 = f"data:image/png;base64,{encoded_string}"
            
        result = engine.process_image(img_b64, num_questions=10)
        
        print("\n--- Resultado do Processamento ---")
        print(f"Sucesso: {result.get('success')}")
        print(f"Marcadores detectados: {result.get('anchors_found')}")
        print(f"QR Data: {result.get('qr_data')}")
        
        if result.get("success"):
            print("Mapeamento de questões realizado com sucesso.")
            # Salvar debug
            if "processed_image" in result:
                print("Imagem auditada gerada.")
        else:
            print(f"Erro: {result.get('error')}")
            
    except Exception as e:
        print(f"Erro no teste: {e}")

if __name__ == "__main__":
    test_omr_engine()
