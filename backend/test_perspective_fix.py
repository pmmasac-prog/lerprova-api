"""
Script de teste para validar as correções de distorção diagonal.
Execute com: python test_perspective_fix.py
"""

import numpy as np
import cv2
import sys
from pathlib import Path

# Adicionar o diretório backend ao path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from omr_engine import OMREngine

def test_order_points_normal():
    """Testa order_points com pontos de câmera paralela (normal)"""
    print("\n=== TESTE 1: Câmera Paralela (Normal) ===")
    
    engine = OMREngine()
    
    # Simular 4 pontos em formato de retângulo perfeito
    # TL, TR, BR, BL (em ordem)
    pts = np.array([
        [100, 100],  # TL
        [500, 100],  # TR
        [500, 700],  # BR
        [100, 700],  # BL
    ], dtype="float32")
    
    ordered = engine.order_points(pts)
    
    print(f"Pontos originais:\n{pts}")
    print(f"Pontos ordenados:\n{ordered}")
    
    # Validar: deve estar em ordem TL, TR, BR, BL
    tl, tr, br, bl = ordered
    assert tl[0] < tr[0], "TL X deve ser < TR X"
    assert tl[1] < bl[1], "TL Y deve ser < BL Y"
    assert br[0] > bl[0], "BR X deve ser > BL X"
    
    print("✅ PASSOU: Pontos ordenados corretamente")
    return True

def test_order_points_perspective_extreme():
    """Testa order_points com pontos de câmera muito inclinada (diagonal)"""
    print("\n=== TESTE 2: Câmera Muito Inclinada (Extremo) ===")
    
    engine = OMREngine()
    
    # Simular perspectiva extrema de cima para baixo
    # Quando câmera está ~70° inclinada, os pontos podem estar fora de ordem
    # Top aparece bem estreito, base é larga
    pts_scrambled = np.array([
        [150, 100],  # Poderia ser TR
        [100, 200],  # Poderia ser TL (detectado fora de ordem)
        [500, 650],  # Poderia ser BR
        [100, 600],  # Poderia ser BL
    ], dtype="float32")
    
    ordered = engine.order_points(pts_scrambled)
    tl, tr, br, bl = ordered
    
    print(f"Pontos desordenados (entrada):\n{pts_scrambled}")
    print(f"Pontos corrigidos (saída):\n{ordered}")
    
    # Validar coordenadas relativas
    print(f"\nValidação:")
    print(f"  TL Y ({tl[1]:.1f}) < BR Y ({br[1]:.1f})? {tl[1] < br[1]}")
    print(f"  TL X ({tl[0]:.1f}) < TR X ({tr[0]:.1f})? {tl[0] < tr[0]}")
    
    assert tl[1] < br[1], "❌ FALHA: TL Y deve ser < BR Y"
    assert tl[0] < tr[0], "❌ FALHA: TL X deve ser < TR X"
    
    print("✅ PASSOU: Pontos corrigidos apesar de entrada desordenada")
    return True

def test_perspective_quality():
    """Testa a validação de qualidade de perspectiva"""
    print("\n=== TESTE 3: Validação de Qualidade de Perspectiva ===")
    
    engine = OMREngine()
    
    # Teste 1: Perspectiva ideal (paralela)
    print("\n  3a. Perspectiva Ideal:")
    rect_ideal = np.array([
        [100, 100],
        [500, 100],
        [500, 700],
        [100, 700]
    ], dtype="float32")
    
    quality = engine._validate_perspective_quality(rect_ideal, (800, 600))
    print(f"     Score: {quality['perspective_score']:.3f}")
    print(f"     Warning: {quality['warning']}")
    print(f"     Message: {quality['message']}")
    assert not quality['warning'], "Perspectiva ideal não deve gerar aviso"
    assert quality['perspective_score'] > 0.95, "Score deve ser alto para perspectiva ideal"
    print("     ✅ PASSOU")
    
    # Teste 2: Perspectiva comprimida (câmera de cima)
    print("\n  3b. Perspectiva Comprimida (Câmera de Cima):")
    rect_compressed = np.array([
        [200, 150],   # TL
        [400, 150],   # TR - top é bem estreito
        [500, 700],   # BR
        [100, 700]    # BL - base bem larga
    ], dtype="float32")
    
    quality = engine._validate_perspective_quality(rect_compressed, (800, 800))
    print(f"     Score: {quality['perspective_score']:.3f}")
    print(f"     Warning: {quality['warning']}")
    print(f"     Message: {quality['message']}")
    assert quality['warning'], "Perspectiva comprimida deve gerar aviso"
    print("     ✅ PASSOU")
    
    # Teste 3: Perspectiva extrema
    print("\n  3c. Perspectiva Extrema:")
    rect_extreme = np.array([
        [250, 100],   # TL - muito comprimido
        [350, 100],   # TR
        [450, 700],   # BR - muito aberto
        [50, 700]     # BL
    ], dtype="float32")
    
    quality = engine._validate_perspective_quality(rect_extreme, (800, 800))
    print(f"     Score: {quality['perspective_score']:.3f}")
    print(f"     Warning: {quality['warning']}")
    print(f"     Message: {quality['message']}")
    assert quality['warning'], "Perspectiva extrema deve gerar aviso"
    assert "muito inclinada" in quality['message'].lower(), "Deve mencionar 'muito inclinada'"
    print("     ✅ PASSOU")
    
    return True

def test_perspective_in_four_point_transform():
    """Testa se a transformação de perspectiva está preservando a ordem"""
    print("\n=== TESTE 4: Transformação Perspectiva ===")
    
    engine = OMREngine()
    
    # Criar uma imagem de teste 600x800 com retângulo
    img_test = np.ones((800, 600, 3), dtype=np.uint8) * 255  # Branco
    
    # Desenhar retângulo nos cantos
    cv2.rectangle(img_test, (50, 50), (550, 750), (0, 0, 0), 2)
    
    # Pontos para transformação (retângulo levemente inclinado)
    rect = np.array([
        [50, 50],      # TL
        [550, 60],     # TR (ligeiramente mais baixo)
        [540, 750],    # BR
        [60, 740]      # BL (ligeiramente mais alto)
    ], dtype="float32")
    
    warped = engine.four_point_transform(img_test, rect)
    
    print(f"Imagem original: {img_test.shape}")
    print(f"Imagem transformada: {warped.shape}")
    assert warped.shape == (1600, 1120, 3), "Dimensões devem ser 1120x1600"
    print("✅ PASSOU: Transformação executada com sucesso")
    
    return True

def main():
    """Executa todos os testes"""
    print("=" * 60)
    print("TESTES DE CORREÇÃO DE DISTORÇÃO DIAGONAL - OMR ENGINE")
    print("=" * 60)
    
    try:
        test_order_points_normal()
        test_order_points_perspective_extreme()
        test_perspective_quality()
        test_perspective_in_four_point_transform()
        
        print("\n" + "=" * 60)
        print("✅ TODOS OS TESTES PASSARAM!")
        print("=" * 60)
        return 0
        
    except AssertionError as e:
        print(f"\n❌ ERRO FATAL: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERRO INESPERADO: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
