# Jukebox da Terra: sons da temperatura

Cada ano da música dura **1 compasso**, de 1950 a 2023.

## Regras gerais

- **Andamento:** 110 BPM, compasso 4/4.
- **Duração do compasso:** **2,18 s** (2,1818 s exatos).
- **Tom:** Ré menor (Ré · Mi · Fá · Sol · Lá · Si♭ · Dó).
- **Formato:** WAV, mono ou estéreo, 44,1 kHz ou 48 kHz.
- **Nomes:** os arquivos devem ter **exatamente** os nomes da lista.
- **Início:** sem silêncio antes da primeira nota; o som começa no tempo 1.

Para conferir, os sons provisórios atuais estão em `audio/provisorio/` (mesmos nomes).

---

## 1. Melodia: 7 arquivos

Pasta: `audio/temperatura/`

O site toca **um arquivo por ano**, conforme o quanto a temperatura muda **até o ano seguinte**.

- **4 notas por compasso**, uma em cada tempo.
- **Todos começam no Ré** (a "casa").
- A **4ª nota** é vizinha do Ré e "puxa" de volta para ele, porque o próximo arquivo sempre começa no Ré.
- Pode ter **cauda** depois do compasso: ela some sozinha em 0,6 s quando o próximo compasso começa.

| Arquivo | Quando toca | Desenho (exemplo atual) |
|---|---|---|
| `temp_base04_parado.wav` | não mudou | Ré · Mi · Ré · Mi (vai e volta duas vezes, sem sair do lugar) |
| `temp_base04_sobe_pequena.wav` | sobe 0,1 °C | Ré · Mi · **Fá** · Mi (a 3ª nota é a mais alta) |
| `temp_base04_sobe_media.wav` | sobe 0,2 a 0,3 °C | Ré · Fá · **Lá** · Fá |
| `temp_base04_sobe_grande.wav` | sobe 0,4 °C ou mais | Ré · Lá · **Ré agudo** · Lá (mais forte) |
| `temp_base04_desce_pequena.wav` | desce 0,1 °C | Ré · Dó · **Si♭** · Dó (a 3ª nota é a mais baixa) |
| `temp_base04_desce_media.wav` | desce 0,2 a 0,3 °C | Ré · Si♭ · **Sol** · Si♭ |
| `temp_base04_desce_grande.wav` | desce 0,4 °C ou mais | Ré · Lá · **Ré grave** · Lá (mais forte) |

As notas podem mudar, mas a ordem precisa continuar clara: **pequena perto do Ré, grande bem longe**, e todos voltando para o Ré.

---

## 2. Tendência: 4 arquivos (loops)

Pasta: `audio/tendencia/`

Toca **junto** com a melodia e mostra o aquecimento ao longo das décadas. Muda só 3 a 5 vezes na música inteira.

- **Loops de exatamente 1 compasso** (2,1818 s), **sem cauda e sem clique** na emenda: o fim emenda no começo.
- **Mesma batida nos 4:** uma nota em cada tempo (4 por compasso).
- Os 4 tocam ao mesmo tempo, sincronizados, e o site só aumenta o volume do nível do momento. Por isso precisam ter **a mesma duração exata**.

| Arquivo | Período | Nota (exemplo atual) |
|---|---|---|
| `tend_base_1.wav` | mais frio | Ré grave |
| `tend_base_2.wav` | | Fá |
| `tend_base_3.wav` | | Lá |
| `tend_base_4.wav` | mais quente | Ré uma oitava acima |

A cada nível o som pode ficar um pouco mais forte e mais brilhante, mas o ritmo deve ser o mesmo nos 4.

---

**Total: 11 arquivos.** Os sons provisórios atuais são de marimba ou sino suave, gerados por computador, só como referência. O timbre fica a critério do músico.
