# Análise: Distorção Diagonal em Fotos Capturadas de Cima

## Problema Identificado

Quando fotos são tiradas do **iPhone 16 Pro Max de cima para baixo** (ângulo aéreo), o gabarito aparece com distorção diagonal em vez de retangular. Isso ocorre em [omr_engine.py](omr_engine.py#L517-L540).

## Causa Raiz

### Falha na Função `order_points()` 

A função ordena os 4 pontos de âncora (cantos) de forma trigonométrica usando `arctan2`, mas **não valida adequadamente qual é o topo real do documento quando a câmera está altamente inclinada**.

**Fluxo problemático:**
1. Função detecta 4 pontos (cantos) ✓
2. `order_points()` ordena em sentido horário: `[TL, TR, BR, BL]` ← *AQUI ESTÁ O PROBLEMA*
3. Tenta garantir formato "retrato" checando se aresta superior é curta
4. Aplica transformação de perspectiva com pontos possivelmente em ordem **ERRADA**
5. Resultado: imagem retificada com distorção diagonal

### Por Que Acontece com iPhone de Cima:

- **Ângulo aéreo**: Câmera apontando ~75° para baixo (ângulo agudo)
- **Perspectiva extrema**: Os 4 cantos projetam-se em espaço 2D de forma não-intuitiva
- **Ordem incorreta**: A função pode estar ordenando os pontos como: `[TL, BL, BR, TR]` ou `[TR, TL, BL, BR]` 
- **Resultado**: `cv2.getPerspectiveTransform()` cria homografia **espelhada/rotacionada**, causando a diagonal

## Código Problemático

```python
def order_points(self, pts):
    """Ordena pontos: TL, TR, BR, BL (sentido horário)"""
    center = np.mean(pts, axis=0)
    
    # Ordena trigonometricamente (atan2)
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    pts_sorted = pts[np.argsort(angles)]  # ← SÓ ORDENA, NÃO VALIDA ORIENTAÇÃO
    
    # Tentativa de validação: se aresta 0 for longa, rotaciona
    # MAS isso pode estar errado quando câmera está inclinada
    if distances[0] > distances[1]:
        pts_sorted = np.roll(pts_sorted, -1, axis=0)
    
    return np.array(pts_sorted, dtype="float32")
```

## Solução Proposta

Adicionar **validação de rotação pós-transformação** + **melhor detecção de orientation** no `order_points()`:

### 1. Detectar Orientação Real da Imagem
```python
# Após warp, se imagem estiver muito "larga" (landscape), rotacionar
if warped.shape[1] > warped.shape[0]:  # width > height
    warped = cv2.rotate(warped, cv2.ROTATE_90_COUNTERCLOCKWISE)
```

### 2. Melhorar Lógica de Ordenação
- Não apenas ordenar trigonometricamente
- Validar que Y do topo < Y da base
- Validar que X da esquerda < X da direita

### 3. Adicionar Detecção de Correcção Necessária
- Após transformação, validar que as âncoras estão nos 4 cantos
- Se não estiverem, tentar rotações automáticas (90°, 180°, 270°)

## Impacto

- **Problema visual**: Gabaritos aparecem distorcidos em diagonal
- **Impacto na leitura OMR**: Posições das bolhas podem estar calculadas incorretamente
- **Taxa de erro**: Aumenta em fotos aéreas do iPhone Pro Max

## Recomendação

Implementar as 3 correções propostas na função `order_points()` e adicionar pós-processamento na função `process_image()` para detectar e corrigir rotações indevidas.
