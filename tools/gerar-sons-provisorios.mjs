// Gera os SONS PROVISÓRIOS da trilha em audio/provisorio/.
// Servem só para ouvir a lógica funcionando enquanto o músico não entrega os arquivos.
// Os arquivos do músico vão em audio/<camada>/ com o MESMO nome e têm prioridade.
//
// Uso: node tools/gerar-sons-provisorios.mjs
//
// Regras seguidas: 110 BPM, 4 tempos por compasso, Ré menor; bases = loops de 1 compasso
// sem emenda (o que passa do fim volta para o começo); sons pontuais = 2 compassos com cauda.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'audio', 'provisorio');
const SR = 24000;
const BPM = 110;
const TEMPO = 60 / BPM;                 // 1 tempo (semínima)
const COMPASSO = 4 * TEMPO;             // ≈ 2,18 s
const N_LOOP = Math.round(COMPASSO * SR);
const N_PONTUAL = Math.round(2 * COMPASSO * SR);

// ---------- utilidades
let semente = 7;
const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const N = { D1: 26, A1: 33, D2: 38, F2: 41, A2: 45, C3: 48, D3: 50, F3: 53, G3: 55, A3: 57, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, C5: 72, D5: 74, F5: 77, G5: 79, A5: 81, C6: 84, D6: 86, F6: 89, A6: 93 };
const PENTA_AGUDA = [N.D5, N.F5, N.G5, N.A5, N.C6, N.D6, N.F6, N.A6];

/** Ajusta a frequência para caber um número inteiro de ciclos no loop (emenda sem clique). */
const fLoop = (f) => Math.max(1, Math.round(f * COMPASSO)) / COMPASSO;

/** Tom sustentado (soma de harmônicos) em todo o buffer. */
function sustentado(buf, f, amp, harm = [1], tremolo = 0) {
  const n = buf.length;
  for (let k = 0; k < harm.length; k++) {
    const fk = fLoop(f * (k + 1));
    if (fk > SR / 2.2) break;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const trem = tremolo ? 1 - tremolo * (0.5 + 0.5 * Math.cos(2 * Math.PI * 4 * t / COMPASSO)) : 1;
      buf[i] += amp * harm[k] * trem * Math.sin(2 * Math.PI * fk * t);
    }
  }
}

/** Nota curta com decaimento; em loop, o que passa do fim volta para o início. */
function nota(buf, inicio, f, amp, { decai = 6, harm = [1, 0.4, 0.15], ataque = 0.004, circular = true, dur = 3 } = {}) {
  const n = buf.length;
  const i0 = Math.round(inicio * SR), len = Math.round(dur * SR);
  for (let j = 0; j < len; j++) {
    let idx = i0 + j;
    if (idx >= n) { if (!circular) break; idx %= n; }
    const t = j / SR;
    const env = Math.min(1, t / ataque) * Math.exp(-decai * t);
    if (env < 1e-4 && t > ataque) break;
    let v = 0;
    for (let k = 0; k < harm.length; k++) v += harm[k] * Math.sin(2 * Math.PI * f * (k + 1) * t);
    buf[idx] += amp * env * v;
  }
}

/** Ruído suave (passa-baixas simples), para a textura da chuva. */
function ruido(buf, amp, suaviza = 0.6) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y = suaviza * y + (1 - suaviza) * (rnd() * 2 - 1); buf[i] += amp * y; }
  // emenda: cruza o fim com o começo em 20 ms
  const m = Math.round(0.02 * SR);
  for (let i = 0; i < m; i++) { const a = i / m; buf[i] = buf[i] * a + buf[buf.length - m + i] * (1 - a); }
}

function normalizar(buf, pico) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] *= pico / max;
  return buf;
}

/** Fade-out final (sons pontuais terminam em silêncio). */
function caudaFinal(buf, seg = 0.4) {
  const m = Math.round(seg * SR);
  for (let i = 0; i < m; i++) buf[buf.length - m + i] *= 1 - i / m;
  return buf;
}

function wav(buf) {
  const dados = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) dados.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dados.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dados.length, 40);
  return Buffer.concat([h, dados]);
}

const arquivos = {};
const loop = (nome, desenhar, pico = 0.5) => { const b = new Float64Array(N_LOOP); desenhar(b); arquivos[nome] = normalizar(b, pico); };
const pontual = (nome, pico, desenhar) => { const b = new Float64Array(N_PONTUAL); desenhar(b); arquivos[nome] = caudaFinal(normalizar(b, pico)); };
const PICO = { p: 0.35, m: 0.55, f: 0.8 };

// ---------- CO₂: drone grave; cada nível é a versão completa, mais densa
const SAW = (n) => Array.from({ length: n }, (_, k) => 1 / (k + 1));
loop('co2_base_1', (b) => { sustentado(b, hz(N.D2), 1, [1, 0.3]); });
loop('co2_base_2', (b) => { sustentado(b, hz(N.D2), 1, [1, 0.4, 0.2]); sustentado(b, hz(N.A2), 0.5, [1, 0.3]); });
loop('co2_base_3', (b) => { sustentado(b, hz(N.D1), 0.6, SAW(8)); sustentado(b, hz(N.D2), 0.8, [1, 0.5, 0.3]); sustentado(b, hz(N.A2), 0.5, [1, 0.4]); sustentado(b, hz(N.D3), 0.3, SAW(5)); });
loop('co2_base_4', (b) => { sustentado(b, hz(N.D1), 0.7, SAW(12), 0.3); sustentado(b, hz(N.D2), 0.8, SAW(6), 0.3); sustentado(b, hz(N.A2), 0.5, SAW(5)); sustentado(b, hz(N.D3), 0.35, SAW(6)); sustentado(b, hz(N.F3), 0.2, SAW(4)); });
for (const [int, h] of [['p', 3], ['m', 6], ['f', 10]]) {
  pontual(`co2_recorde_${int}`, PICO[int], (b) => {
    // swell: cresce por ~1,2 s e se desfaz até o fim dos 2 compassos
    for (const [f, a] of [[hz(N.D2), 1], [hz(N.A2), 0.6], [hz(N.D3), 0.5], [hz(N.F3), int === 'f' ? 0.4 : 0]]) {
      if (!a) continue;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR, env = t < 1.2 ? (t / 1.2) ** 2 : Math.exp(-(t - 1.2) * 1.1);
        let v = 0; for (let k = 1; k <= h; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
        b[i] += a * env * v;
      }
    }
  });
}

// ---------- Temperatura: 6 COMPASSOS, do ano mais frio (1) ao mais quente (6)
// Duas bases em teste (o site tem um seletor Base01/Base02 no topo; na versão final fica só uma):
//   Base01 = 4 semínimas por compasso (melodia)
//   Base02 = 1 nota sustentada o compasso inteiro (semibreve), em loop contínuo
//   Base03 = 2 mínimas ligadas (legato), as duas do acorde; a 2ª aponta para a faixa seguinte
// Regras comuns: Ré menor, mesmo timbre por nível; nota inicial e final do compasso sempre do
// acorde (Ré, Fá ou Lá), para que qualquer compasso possa vir depois de qualquer outro. Do frio ao
// quente sobem o registro, o brilho (mais harmônicos) e, na Base01, a tensão (notas fora do
// acorde, saltos). O 3 (perto da média) é o mais cantável.
// Base01: o arquivo tem 1 compasso + cauda; a cauda some quando o próximo compasso começa.
// (Sem acorde de fundo: soava como um grave contínuo por baixo.)
const N_COMPASSO = Math.round((COMPASSO + 1.2) * SR);
const compasso = (nome, desenhar, pico = 0.5) => { const b = new Float64Array(N_COMPASSO); desenhar(b); arquivos[nome] = caudaFinal(normalizar(b, pico), 0.6); };
const M = { D3: 50, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81 };
const FIGURAS = [
  // Base01: melodia (4 semínimas)  Base02: nota longa  Base03: 2 mínimas  timbre (igual nas 3 bases)
  { notas: ['D4', 'C4', 'Bb3', 'A3'], longa: 'A3', minimas: ['D4', 'A3'], harm: [1, 0.1],                  decai: 2.2 },  // 1 mais frio: grave, escuro
  { notas: ['A3', 'C4', 'E4', 'D4'],  longa: 'D4', minimas: ['A3', 'D4'], harm: [1, 0.25, 0.05],           decai: 2.4 },
  { notas: ['D4', 'E4', 'F4', 'A4'],  longa: 'F4', minimas: ['D4', 'F4'], harm: [1, 0.35, 0.12],           decai: 2.6 },  // 3 "neutro"
  { notas: ['A4', 'G4', 'F4', 'A4'],  longa: 'A4', minimas: ['F4', 'A4'], harm: [1, 0.45, 0.2, 0.08],      decai: 2.8 },
  { notas: ['A4', 'C5', 'E5', 'D5'],  longa: 'D5', minimas: ['A4', 'D5'], harm: [1, 0.55, 0.3, 0.15],      decai: 3.0 },
  { notas: ['D5', 'F5', 'E5', 'A5'],  longa: 'F5', minimas: ['D5', 'F5'], harm: [1, 0.6, 0.4, 0.25, 0.12], decai: 3.2 },  // 6 mais quente: agudo, brilhante
];
const ACENTO = [1, 0.7, 0.85, 0.75];   // tempo 1 forte, 3 meio-forte

// Base01: 4 semínimas
FIGURAS.forEach((fig, k) => compasso(`temp_base01_compasso_${k + 1}`, (b) => {
  fig.notas.forEach((n, q) => nota(b, q * TEMPO, hz(M[n]), 0.55 * ACENTO[q], { decai: fig.decai, harm: fig.harm, ataque: 0.012, circular: false, dur: 2 }));
  // compassos 5 e 6: um brilho uma oitava acima no contratempo
  if (k >= 4) [0, 2].forEach((q) => nota(b, q * TEMPO + TEMPO / 2, hz(M[fig.notas[q]] + 12), 0.12 * (k - 3), { decai: 7, harm: [1, 0.3], circular: false }));
}));

// Base02: 1 nota sustentada, CONTÍNUA. Cada arquivo é um LOOP de exatamente 1 compasso, sem
// envelope (o fim emenda no começo): os 6 tocam juntos e o site só abre o do ano. Assim, quando a
// mesma nota se repete em anos seguidos, ela simplesmente continua, sem novo ataque.
FIGURAS.forEach((fig, k) => loop(`temp_base02_compasso_${k + 1}`, (b) => sustentado(b, hz(M[fig.longa]), 1, fig.harm)));
// Base03: 2 mínimas LIGADAS (1,09 s cada), mesmo timbre da Base02. Ataque suave em cada nota e
// a 1ª se desfaz enquanto a 2ª entra (legato). 1 compasso + cauda, como a Base01.
const LIGA = 0.08;   // s: sobreposição entre as duas notas
FIGURAS.forEach((fig, k) => compasso(`temp_base03_compasso_${k + 1}`, (b) => {
  const MINIMA = 2 * TEMPO;
  fig.minimas.forEach((n, q) => {
    const f = hz(M[n]), ini = q * MINIMA, fim = ini + MINIMA;
    for (let i = Math.round(ini * SR); i < b.length; i++) {
      const t = i / SR, u = t - ini;
      // ataque de 50 ms, leve queda enquanto segura; depois do fim da mínima: solta (curto se vem
      // outra nota, longo na cauda do compasso)
      let env = Math.min(1, u / 0.05) * (1 - 0.2 * Math.min(1, u / MINIMA));
      if (t > fim) env *= q === 0 ? Math.max(0, 1 - (t - fim) / LIGA) : Math.exp(-(t - fim) * fig.decai);
      if (env < 1e-4 && t > fim) break;
      let v = 0;
      for (let h = 0; h < fig.harm.length; h++) v += fig.harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * u);
      b[i] += (q === 0 ? 1 : 0.92) * env * v;
    }
  });
}));

// Base04 (EM TESTE): MOVIMENTO. O compasso mostra a mudança até o ano seguinte, não a altura do ano.
// Todas as figuras começam no Ré4 (a "casa") e a 4ª nota é vizinha de uma nota do acorde, puxando
// de volta para o Ré4 do compasso seguinte; por isso qualquer figura pode vir depois de qualquer outra.
// Quanto maior a variação, mais longe a melodia vai antes de voltar. As grandes saem um pouco mais fortes.
// Timbre do nível 3 (neutro) das outras bases.
const MOV = { harm: [1, 0.35, 0.12], decai: 2.6 };
const FIG_MOV = {
  parado: { notas: [['D4', 0], ['E4', 1], ['D4', 2], ['E4', 3]] },              // ida e volta duas vezes: Ré · Mi · Ré · Mi
  sobe_pequena: { notas: [['D4', 0], ['E4', 1], ['F4', 2], ['E4', 3]] },
  sobe_media: { notas: [['D4', 0], ['F4', 1], ['A4', 2], ['F4', 3]] },
  sobe_grande: { notas: [['D4', 0], ['A4', 1], ['D5', 2], ['A4', 3]], pico: 0.6, brilho: [1, 0.5, 0.25, 0.1] },
  desce_pequena: { notas: [['D4', 0], ['C4', 1], ['Bb3', 2], ['C4', 3]] },
  desce_media: { notas: [['D4', 0], ['Bb3', 1], ['G3', 2], ['Bb3', 3]] },
  desce_grande: { notas: [['D4', 0], ['A3', 1], ['D3', 2], ['A3', 3]], pico: 0.6, brilho: [1, 0.5, 0.25, 0.1] },
};
for (const [nome, fig] of Object.entries(FIG_MOV)) {
  compasso(`temp_base04_${nome}`, (b) => fig.notas.forEach(([n, q]) =>
    nota(b, q * TEMPO, hz(M[n]), 0.55 * (ACENTO[Math.floor(q)] ?? 0.75), { decai: MOV.decai, harm: fig.brilho ?? MOV.harm, ataque: 0.012, circular: false, dur: 2 })), fig.pico ?? 0.5);
}

// Temperatura, Pontual01 (EM TESTE): picos e vales da linha do gráfico (ano mais alto / mais baixo de uma oscilação).
// Arpejo rápido de Ré menor (Ré–Fá–Lá–Ré) em semicolcheias, uma oitava acima das bases, com timbre
// de sino suave para se destacar sem brigar. Começa e termina em Ré (nota do acorde), no tempo 1.
// O som anuncia para onde a linha VAI: no pico ela começa a descer, então toca o arpejo que desce
// (Ré6 → Ré5); no vale ela começa a subir, então toca o que sobe (Ré5 → Ré6). 2 compassos com cauda natural.
const SINO = { decai: 1.6, harm: [1, 0.3, 0.12], ataque: 0.006, circular: false, dur: 3.5 };
for (const [nome, notas] of [['pico', [M.D5 + 12, M.A5, M.F5, M.D5]], ['vale', [M.D5, M.F5, M.A5, M.D5 + 12]]]) {
  pontual(`temp_pontual01_${nome}`, 0.32, (b) => notas.forEach((m, j) => nota(b, j * TEMPO / 4, hz(m), j === 3 ? 1 : 0.75, SINO)));
}

for (const int of ['p', 'm', 'f']) {
  pontual(`temp_recorde_${int}`, PICO[int], (b) => {
    // sino: acorde com parciais inarmônicas, cada nota um pouco depois da outra
    const notas = int === 'p' ? [N.D5, N.A5] : int === 'm' ? [N.D5, N.F5, N.A5] : [N.D5, N.F5, N.A5, N.C6, N.D6];
    notas.forEach((m, k) => nota(b, k * 0.09, hz(m), 1, { decai: 0.9, harm: [1, 0, 0.5, 0, 0, 0.25], circular: false, dur: 4.6 }));
  });
}

// ---------- Tendência da temperatura (EM TESTE): toca junto com a Base04 e mostra o aquecimento ao
// longo das décadas (média de 11 anos, 4 níveis). Timbre de marimba (batida curta), diferente do drone
// do CO₂. Todos os níveis têm o MESMO ritmo: uma batida em cada tempo. O que muda é a nota, que
// "sobe de andar" pelas notas do acorde (as mais estáveis, que combinam com qualquer figura da Base04):
// 1 = Ré grave · 2 = Fá · 3 = Lá · 4 = Ré uma oitava acima. A cada nível, um pouco mais forte e brilhante.
const MARIMBA = (brilho) => ({ decai: 4, harm: [1, 0, 0.35 * brilho, 0, 0.15 * brilho], ataque: 0.003 });
[[N.D3, 0.6, 0.30], [N.F3, 0.75, 0.34], [N.A3, 0.9, 0.38], [N.D4, 1.05, 0.42]].forEach(([m, brilho, pico], k) =>
  loop(`tend_base_${k + 1}`, (b) => [0, 1, 2, 3].forEach((q) => nota(b, q * TEMPO, hz(m), q === 0 ? 1 : 0.8, MARIMBA(brilho))), pico));

// ---------- Chuva: gotas agudas, mais densas a cada nível
const gotas = (b, quantas, amp = 0.5) => {
  for (let g = 0; g < quantas; g++) {
    const pos = Math.floor(rnd() * 16) * TEMPO / 4;   // presas na grade de semicolcheias
    nota(b, pos, hz(PENTA_AGUDA[Math.floor(rnd() * PENTA_AGUDA.length)]), amp * (0.6 + 0.4 * rnd()), { decai: 14, harm: [1, 0.2] });
  }
};
loop('chuva_base_1', (b) => { gotas(b, 2); ruido(b, 0.02); });
loop('chuva_base_2', (b) => { gotas(b, 5); ruido(b, 0.04); });
loop('chuva_base_3', (b) => { gotas(b, 10); ruido(b, 0.07); });
loop('chuva_base_4', (b) => { gotas(b, 18); ruido(b, 0.12, 0.3); });
for (const int of ['m', 'f']) {
  pontual(`chuva_seca_${int}`, PICO[int], (b) => {
    // seca: notas que descem e perdem brilho
    [N.A5, N.G5, N.F5, N.D5, N.C5, N.A4].forEach((m, k) => nota(b, k * TEMPO * 0.66, hz(m), 1 - k * 0.12, { decai: 2.5, harm: k < 3 ? [1, 0.3] : [1], circular: false }));
  });
  pontual(`chuva_extrema_${int}`, PICO[int], (b) => {
    // chuva extrema: cascata que se adensa
    const total = int === 'f' ? 48 : 30;
    for (let g = 0; g < total; g++) {
      const t = 1.8 * Math.sqrt(g / total);
      nota(b, t, hz(PENTA_AGUDA[Math.floor(rnd() * PENTA_AGUDA.length)]), 0.5 + 0.5 * (g / total), { decai: 6, harm: [1, 0.3], circular: false });
    }
  });
}

// ---------- Vegetação: arpejo dedilhado no médio-agudo, mais notas a cada nível
const ARP = [N.D4, N.A4, N.F5, N.D5, N.A4, N.F5, N.C5, N.A4];
const DEDILHADO = { decai: 5, harm: [1, 0.6, 0.3, 0.15] };
const arpejo = (b, posicoes) => posicoes.forEach((k) => nota(b, k * TEMPO / 2, hz(ARP[k]), 0.5, DEDILHADO));
loop('veg_base_1', (b) => arpejo(b, [0, 4]));
loop('veg_base_2', (b) => arpejo(b, [0, 2, 4, 6]));
loop('veg_base_3', (b) => arpejo(b, [0, 1, 2, 4, 5, 6]));
loop('veg_base_4', (b) => { arpejo(b, [0, 1, 2, 3, 4, 5, 6, 7]); [1, 3, 5, 7].forEach((k) => nota(b, k * TEMPO / 2 + TEMPO / 4, hz(ARP[k] + 12), 0.2, DEDILHADO)); });
for (const int of ['m', 'f']) {
  pontual(`veg_queda_${int}`, PICO[int], (b) => {
    // queda: o acorde vai perdendo notas (5, depois 3, depois 1)
    const acorde = [N.D4, N.F4, N.A4, N.C5, N.D5];
    [acorde, [N.D4, N.A4, N.D5], [N.D4]].forEach((ns, k) => ns.forEach((m, j) => nota(b, k * TEMPO * 1.4 + j * 0.05, hz(m), 0.8, { ...DEDILHADO, decai: 2.2, circular: false })));
  });
}

mkdirSync(SAIDA, { recursive: true });
for (const [nome, b] of Object.entries(arquivos)) writeFileSync(join(SAIDA, `${nome}.wav`), wav(b));
console.log(`OK: ${Object.keys(arquivos).length} sons provisórios em ${SAIDA} (loop = ${(N_LOOP / SR).toFixed(3)} s)`);
