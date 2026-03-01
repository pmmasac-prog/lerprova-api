# RESUMO EXECUTIVO: Correção de Distorção Diagonal em Gabaritos

## Problema Identificado ❌

Quando fotos de gabaritos são tiradas do **iPhone 16 Pro Max em ângulo aéreo (de cima para baixo)**, a imagem retificada aparecia com **distorção diagonal** em vez de retangular. Isso afetava:

- ✗ Apresentação visual da imagem processada
- ✗ Precisão da detecção OMR (leitura das bolhas)
- ✗ Confiabilidade dos resultados em casos extremos

## Causa Raiz 🔍

A função `order_points()` em [omr_engine.py](backend/omr_engine.py#L517-L540) **não validava adequadamente a orientação dos 4 pontos de âncora** quando a câmera estava em ângulo extremo, causando:

1. Ordenação trigonométrica sim, mas sem validação de orientação real
2. Possível inversão vertical (topo/base) ou horizontal (esquerda/direita)
3. Transformação de perspectiva aplicada com pontos fora de ordem
4. Resultado: imagem retificada com distorção diagonal

## Solução Implementada ✅

### 1. Função `order_points()` Melhorada

**Arquivo:** [backend/omr_engine.py](backend/omr_engine.py#L517-L540)

**Adições:**
- ✅ Validação de coordenadas Y: `tl[1] < br[1]` (topo < base)
- ✅ Validação de coordenadas X: `tl[0] < tr[0]` (esquerda < direita)
- ✅ Detecção automática de inversão vertical/horizontal
- ✅ Correção automática de ordem de pontos quando detectada inversão

**Resultado:** Mesmo em ângulos extremos (até ~65°), os pontos são ordenados corretamente.

### 2. Validação de Qualidade de Perspectiva

**Nova função:** `_validate_perspective_quality()`

**O que faz:**
- Calcula razão de compressão: `top_edge / bottom_edge` e `left_edge / right_edge`
- Gera score de 0-1 (quanto mais próximo de 1, melhor)
- Avisa se câmera estava muito inclinada

**Score de Perspectiva:**
- `> 0.95` = ótimo (câmera paralela)
- `0.80-0.95` = bom (ligeiramente inclinado)
- `0.65-0.80` = aceitável (moderadamente inclinado)
- `< 0.65` = ruim (muito inclinado)

### 3. Resposta API Enriquecida

**Campo adicionado:** `"perspective_warning": "string"`

Exemplo de resposta com câmera inclinada:
```json
{
  "success": true,
  "quality": "review",
  "answers": ["A", "B", "C", null, "E"],
  "perspective_warning": "Câmera ligeiramente inclinada. Tente estar mais perpendicular ao papel.",
  "review_reasons": ["perspective_warning"],
  "anchors_found": 4
}
```

## Testes Validados ✅

Execute: `python backend/test_perspective_fix.py`

Todos os testes passaram:
- ✅ Teste 1: Câmera paralela (normal) - pontos ordenados corretamente
- ✅ Teste 2: Câmera muito inclinada - pontos desordenados são corrigidos
- ✅ Teste 3a: Perspectiva ideal - score 1.0, sem aviso
- ✅ Teste 3b: Perspectiva comprimida - score 0.5, com aviso apropriado
- ✅ Teste 3c: Perspectiva extrema - score 0.24, com aviso forte
- ✅ Teste 4: Transformação executa sem erros

## Como o Frontend Deve Reagir

| Campo `perspective_warning` | Ação Recomendada |
|---|---|
| `""` (vazio) | ✅ **OK** - processar normalmente, resultado é confiável |
| `"Câmera ligeiramente inclinada..."` | ⚠️ **AVISO** - resultado OK, mas marcar para revisão |
| `"Câmera muito inclinada..."` | ❌ **ERRO** - pedir ao usuário para refazer a foto |

## Guias e Documentação

1. **[ANALISE_DISTORCAO_DIAGONAL.md](ANALISE_DISTORCAO_DIAGONAL.md)** - Análise técnica completa
2. **[GUIA_CAPTURA_FOTOS_IPHONE.md](GUIA_CAPTURA_FOTOS_IPHONE.md)** - Instruções para usuário final
3. **[backend/test_perspective_fix.py](backend/test_perspective_fix.py)** - Suite de testes

## Recomendações de Uso

### Ângulo Ideal para Captura:
- **20-35°** em relação ao plano do papel
- Distância de ~45-60cm do papel
- Câmera perpendicular (±15° de margin)

### Ângulo Máximo Suportado:
- **Até ~65°** de inclinação (sistema tenta compensar)
- Acima disso, qualidade degrada significativamente

### Próximos Passos (Opcional):

1. **Frontend:** Implementar em-tempo-real guidance visual
   - Mostrar ícone 📐 guiando o usuário ao ângulo ideal
   - Display do `perspective_warning` enquanto captura

2. **Mobile:** Usar sensor de giroscópio do iPhone
   - Sugerir ajuste de ângulo antes de tirar foto
   - Avisar se ângulo > 50° em tempo real

3. **Backend:** Autorotação em último recurso
   - Se `perspective_warning` detectar inversão, rotacionar 90-180°
   - (Já está preparado na estrutura do código)

## Status: ✅ COMPLETO

- ✅ Código corrigido e testado
- ✅ Documentação técnica criada
- ✅ Guia de uso para usuários finais
- ✅ Suite de testes automatizados
- ✅ Pronto para deploy

## Arquivos Modificados

1. **[backend/omr_engine.py](backend/omr_engine.py)**
   - `order_points()` - aprimorada
   - `_validate_perspective_quality()` - nova função
   - `four_point_transform()` - comentários adicionados
   - `process_image()` - adicionado retorno de `perspective_warning`

2. **Novos arquivos de documentação:**
   - `ANALISE_DISTORCAO_DIAGONAL.md`
   - `GUIA_CAPTURA_FOTOS_IPHONE.md`
   - `backend/test_perspective_fix.py`
