# Como Testar a Correção com Fotos Reais do iPhone

## Passo 1: Preparar Gabarito de Teste

1. Imprima um gabarito (A4) ou use um que já tenha
2. Certifique-se que os **4 cantos pretos são bem visíveis**

## Passo 2: Capturar Fotos em Diferentes Ângulos

Use o iPhone 16 Pro Max para capturar as mesmas 3 variações:

### Variação A: Ângulo Correto ✅
- **Ângulo:** ~30° em relação ao papel
- **Distância:** ~50cm
- **Expectativa:** 
  - `perspective_warning: ""` (vazio)
  - `anchors_found: 4`
  - Imagem retificada sem distorção

### Variação B: Ligeiramente Inclinado ⚠️
- **Ângulo:** ~45-50°
- **Distância:** ~50cm
- **Expectativa:**
  - `perspective_warning: "Câmera ligeiramente inclinada..."`
  - `review_reasons: ["perspective_warning"]`
  - Imagem retificada mas com aviso

### Variação C: Muito Inclinado (De Cima) ❌
- **Ângulo:** ~70-75° (câmera apontando quase direto para baixo)
- **Distância:** ~40cm
- **Expectativa:**
  - `perspective_warning: "Câmera muito inclinada..."`
  - Possível falha em detecção de âncoras
  - Ou imagem retificada com aviso forte

## Passo 3: Fazer Upload e Testar

### Via Frontend (se disponível):
1. Acesse a interface de scan de gabaritos
2. Selecione o gabarito
3. Capture as 3 fotos
4. Observe os warnings/alertas

### Via API Diretamente:

```bash
# Converter foto para base64 (no PowerShell):
$image = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\foto_iphone.jpg"))

# Fazer POST
$body = @{
    image = "data:image/jpeg;base64,$image"
    num_questions = 25
    layout_version = "v1.1-a4-calibrated"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/provas/processar" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer YOUR_TOKEN" } `
    -Body $body `
    -ContentType "application/json" | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

## Passo 4: Verificar Resposta

Procure por:

```json
{
  "success": true,
  "quality": "ok",        // ou "review" se houver warning
  "anchors_found": 4,
  "perspective_warning": "",  // vai estar preenchido se houver problema
  "review_reasons": []    // vai conter "perspective_warning" se necessário
}
```

## Passo 5: Validar Visualmente

1. Se `processed_image` for retornado, salve como base64 e visualize:
   - Deve estar retificado (quadrado, não diagonal)
   - Os 4 cantos devem estar bem marcados

2. Se `audit_map` for retornado:
   - Deve mostrar as bolhas marcadas com retângulos
   - Verde = resposta válida
   - Amarelo = ambígua
   - Vermelho = múltiplas marcações
   - Azul = branco

## Resultados Esperados

### Teste Passou ✅
Se você vê:
- Variação A → sem warning
- Variação B → warning "ligeiramente"
- Variação C → warning "muito" ou falha

Então a **correção está funcionando!**

### Teste Falhou ❌
Se você vê:
- Tudo sem warning (por padrão)
- OU warnings aparecendo em ângulos normais (falso positivo)
- OU distorção diagonal na imagem retificada

Então há **outro problema** não coberto por essa correção.

## Troubleshooting

### Problema: Sempre retorna `anchors_found: 0`
- Certifique-se que os 4 cantos pretos são bem nítidos
- Mude a iluminação (naturalmente mais clara é melhor)
- Os cantos devem ter 7mm em papel A4

### Problema: Imagem retificada está diagonal (antes da correção)
- Abra `backend/diagnostics/` para ver diagnósticos salvos
- Procure arquivos `*_warped.jpg` para ver o resultado de transformação

### Problema: Warning positivo mesmo com ângulo correto
- Pode ser falso positivo em baixa iluminação
- Tente novamente com mais luz
- Se persistir, ajuste threshold em `_validate_perspective_quality()` linha ~393

## Arquivos de Debug

Após processar uma imagem, verifique:
- `backend/diagnostics/scan_*.jpg` - Imagens original, warped, audit
- `backend/debug_logs/*.json` - Logs de erro se houver

## Comando para Limpar Diagnósticos Antigos

```powershell
# PowerShell
Remove-Item backend/diagnostics/* -Recurse -Force
Remove-Item backend/debug_logs/* -Force
```

## Próximas Validações

1. **Testar com múltiplos iPhones** (não só Pro Max)
   - Device de teste principal: iPhone 16 Pro Max ✅
   - Testar com: iPhone 15, 14, 13, etc.

2. **Diferentes layouts**
   - Testar com `layout_version="v1.1-a4-calibrated"` ✅
   - Testar com `layout_version="v1"` (legado)

3. **Diferentes números de questões**
   - Testar com 20, 25, 30 questões
   - Validar que bolhas estão nas posições corretas

## Sucesso! 🎉

Se tudo passou nos 3 testes, as correções estão prontas para produção.

Próximas fases (opcional):
1. Melhorar feedback visual no frontend durante captura
2. Implementar giroscópio do iPhone para guidance em tempo real
3. Auto-rotação automática (90°/180°/270°) como último recurso
