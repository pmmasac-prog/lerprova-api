# Guia de Captura de Fotos para Gabaritos - iPhone 16 Pro Max

## Recomendações de Ânguloção

### ❌ NÃO FAÇA ISSO:
- **Foto muito de cima** (câmera apontando 75°+ para baixo)
  - Causa distorção diagonal extrema
  - Dificulta detecção de âncoras
  - Resulta em "perspective_warning" no sistema

- **De lado** (ângulo > 45° lateral)
  - Comprime horizontalmente as bolhas
  - Falha na leitura OMR

- **Muito perto** ou **muito longe**
  - Âncoras não cabem no frame
  - Bolhas ficam muito pequenas para leitura

### ✅ FAÇA ISSO:

**Ângulo ideal: 20-35° em relação ao papel**
- Segure o iPhone a ~45-60cm do papel
- Câmera perpendicular ao plano do papel (±15°)
- Todo o papel deve estar visível no frame
- Os 4 cantos pretos devem estar bem visíveis

**Posição do papel:**
- Coloque em uma superfície plana (mesa, caderno)
- NÃO segure em mãos (pode tremer)
- Boa iluminação (luz natural ou LED)

**Framing:**
- Os 4 cantos pretos (âncoras) DEVEM aparecer
- Margem de 2-3cm ao redor do papel
- Não corte nenhum canto

## O Que Mudou no Sistema

### Melhorias Implementadas (Backend)

1. **`order_points()` aprimorada** - Detecta corretamente a orientação mesmo com câmera inclinada
   - Valida que Y do topo < Y da base
   - Valida que X da esquerda < X da direita
   - Protege contra inversões de ordem de pontos

2. **Nova função `_validate_perspective_quality()`** - Avalia a qualidade da perspectiva
   - Calcula razão de compressão (top/bottom, left/right)
   - Retorna score de -1.0 a 1.0
   - Avisa no response se câmera estava muito inclinada

3. **Resposta agora inclui** `"perspective_warning": "mensagem"`
   - String vazia = ótima perspectiva
   - "Câmera ligeiramente inclinada..." = qualidade aceitável
   - "Câmera muito inclinada..." = foto ruim, refaça

### Compensação para Câmera Inclinada

O sistema agora **tenta compensar** ângulos de até 65° de inclinação através de:
- Melhor detecção de âncoras mesmo com perspectiva extrema
- Validação bidimensional (X e Y) dos pontos ordenados
- Detecção de quando a perspectiva foi demais (e aviso ao usuário)

## Resposta do API (Exemplo)

```json
{
  "success": true,
  "quality": "review",
  "answers": ["A", "B", "C", null, "E"],
  "confidence_scores": [0.95, 0.88, 0.92, 0.0, 0.87],
  "perspective_warning": "Câmera ligeiramente inclinada. Tente estar mais perpendicular ao papel.",
  "review_reasons": ["perspective_warning"],
  "anchors_found": 4,
  "avg_confidence": 0.73
}
```

### Como o Frontend Deve Reagir

| `perspective_warning` | Ação no App |
|---|---|
| ""  (vazio) | ✅ OK - processar normalmente |
| "ligeiramente inclinada..." | ⚠️ AVISO - usar com cuidado, revisar na frente |
| "muito inclinada..." | ❌ ERRO - pedir ao usuário para refazer a foto |

## Teste Recomendado

1. Tire foto de forma "correta" (20-35°) ← deve ter `perspective_warning = ""`
2. Tire foto "muito de cima" (70°+) ← deve ter aviso
3. Tire foto "de lado" (45°+) ← pode falhar na detecção de âncoras

Se os avisos aparecerem corretamente, o sistema está funcionando! 🎉

## Notas Técnicas

- **Limite de distorção**: Sistema aguenta até ~65° de inclinação
- **Qualidade OMR**: Melhor acima de 80% perspectiva_score
- **False positives**: Podem ocorrer em luz muito fraca
- **Âncoras de canto preto**: Devem ter 7mm em papel A4 (design do template)
