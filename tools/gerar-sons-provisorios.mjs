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
const N = { D1: 26, A1: 33, C2: 36, D2: 38, F2: 41, G2: 43, A2: 45, Bb2: 46, E3: 52, C3: 48, D3: 50, F3: 53, G3: 55, A3: 57, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, C5: 72, D5: 74, F5: 77, G5: 79, A5: 81, C6: 84, D6: 86, F6: 89, A6: 93 };
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

// ---------- CO₂
const SAW = (n) => Array.from({ length: n }, (_, k) => 1 / (k + 1));
// 5 vozes que se acumulam. Cada arquivo é UMA voz; o site toca a voz 1,
// depois 1+2, 1+2+3… Todas cabem juntas: cada uma soa bem sozinha e somada às anteriores.
// Cada voz é uma FRASE de 4 compassos (loop de 8,73 s) com uma leve variação dentro dela, para o
// som contínuo não ficar parado. O site não mexe em nada: só liga e desliga a voz no início do compasso.
const COMPASSOS_FRASE = 4;
const N_FRASE = COMPASSOS_FRASE * N_LOOP;
const frase = (nome, desenhar, pico) => { const b = new Float64Array(N_FRASE); desenhar(b); arquivos[nome] = normalizar(b, pico); };
const DUR_FRASE = N_FRASE / SR;
/** Janela suave e circular entre os tempos ini e fim (em tempos de semínima, 0..16), rampa em s. */
const janela = (t, ini, fim, rampa = 0.25) => {
  const a = ini * TEMPO, z = fim * TEMPO;
  let x = ((t - a) % DUR_FRASE + DUR_FRASE) % DUR_FRASE;     // tempo desde o início da janela, dando a volta
  const largura = z - a;
  if (x > largura + rampa) x -= DUR_FRASE;                   // ainda no fim da janela anterior
  if (x < -rampa || x > largura + rampa) return 0;
  const sobe = Math.min(1, (x + rampa) / (2 * rampa)), desce = Math.min(1, (largura + rampa - x) / (2 * rampa));
  return Math.sin((Math.PI / 2) * Math.max(0, Math.min(sobe, desce))) ** 2;
};
/** Tom contínuo na frase inteira (ciclos inteiros: emenda sem clique), volume dado por env(t). */
function tomFrase(buf, f, harm, env) {
  for (let k = 0; k < harm.length; k++) {
    const fk = Math.max(1, Math.round(f * (k + 1) * DUR_FRASE)) / DUR_FRASE;
    if (fk > SR / 2.2) break;
    for (let i = 0; i < buf.length; i++) { const t = i / SR; buf[i] += harm[k] * env(t) * Math.sin(2 * Math.PI * fk * t); }
  }
}
const respira = (t, quanto, voltas = 1) => 1 - quanto * (0.5 + 0.5 * Math.cos(2 * Math.PI * voltas * t / DUR_FRASE)); // cresce e volta na frase
const pulso4 = (t, fundo) => 1 - fundo * (0.5 + 0.5 * Math.cos(2 * Math.PI * t / TEMPO));                         // pulsa nos tempos

/** Nota que sai da base e volta: base o tempo todo, menos nas trocas [[início, fim, midi], …] (em tempos, 0..16). */
function comTrocas(buf, base, trocas, harm, extra = () => 1) {
  const fora = (t) => trocas.reduce((s, [a, z]) => s + janela(t, a, z, 0.2), 0);
  tomFrase(buf, hz(base), harm, (t) => extra(t) * (1 - fora(t)));
  for (const [a, z, m] of trocas) tomFrase(buf, hz(m), harm, (t) => extra(t) * janela(t, a, z, 0.2));
}

// 1. Ré grave, a base: no compasso 2 desce para o Dó e volta; no 4 sobe para o Fá e volta. Respira na frase.
frase('co2_voz_1', (b) => {
  comTrocas(b, N.D2, [[6, 8, N.C2], [14, 16, N.F2]], [1, 0.45, 0.25], (t) => respira(t, 0.25));
}, 0.25);
// 2. Lá (a quinta): no compasso 3 desce para o Sol e volta; no 4 sobe meio tom para o Si♭ e volta
frase('co2_voz_2', (b) => {
  comTrocas(b, N.A2, [[10, 12, N.G2], [14, 16, N.Bb2]], [1, 0.3]);
}, 0.2);
// 3. Ré bem grave e áspero: um empurrão no 1º tempo de cada compasso; no compasso 3 o peso cai no Lá e volta
frase('co2_voz_3', (b) => {
  const empurrao = (t) => { const x = t % COMPASSO, n = Math.floor(t / COMPASSO); return (n % 2 === 0 ? 0.45 : 0.25) * Math.min(1, x / 0.04) * Math.exp(-x * 2.2); };
  comTrocas(b, N.D1, [[8, 12, N.A1]], SAW(8), (t) => 0.65 + empurrao(t));
}, 0.22);
// 4. Ré + Fá pulsando nos 4 tempos; no compasso 3 o Fá desce para o Mi e volta
frase('co2_voz_4', (b) => {
  tomFrase(b, hz(N.D3), SAW(4), (t) => 0.6 * pulso4(t, 0.6));
  tomFrase(b, hz(N.F3), SAW(4), (t) => pulso4(t, 0.6) * (1 - janela(t, 8, 12, 0.2)));
  tomFrase(b, hz(N.E3), SAW(4), (t) => pulso4(t, 0.6) * janela(t, 8, 12, 0.2));
}, 0.18);
// 5. Mi + Fá colados (tensão); no compasso 2 o par sobe para Fá + Sol e no 4 cresce mais
frase('co2_voz_5', (b) => {
  const sobe = (t) => janela(t, 4, 8, 0.2);
  const forte = (t) => 0.8 + 0.35 * janela(t, 12, 16, 0.8);
  tomFrase(b, hz(N.E4), SAW(4), (t) => pulso4(t, 0.4) * forte(t) * (1 - sobe(t)));
  tomFrase(b, hz(N.F4), SAW(4), (t) => pulso4(t, 0.4) * forte(t));
  tomFrase(b, hz(N.G4), SAW(4), (t) => pulso4(t, 0.4) * forte(t) * sobe(t));
}, 0.15);

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

// ---------- Temperatura
// O arquivo tem 1 compasso + cauda; a cauda some quando o próximo compasso começa.
const N_COMPASSO = Math.round((COMPASSO + 1.2) * SR);
const compasso = (nome, desenhar, pico = 0.5) => { const b = new Float64Array(N_COMPASSO); desenhar(b); arquivos[nome] = caudaFinal(normalizar(b, pico), 0.6); };
const M = { D3: 50, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81 };
const ACENTO = [1, 0.7, 0.85, 0.75];   // tempo 1 forte, 3 meio-forte

// MOVIMENTO: o compasso mostra a mudança até o ano seguinte, não a altura do ano.
// Todas as figuras começam no Ré4 (a "casa") e a 4ª nota é vizinha de uma nota do acorde, puxando
// de volta para o Ré4 do compasso seguinte; por isso qualquer figura pode vir depois de qualquer outra.
// Quanto maior a variação, mais longe a melodia vai antes de voltar. As grandes saem um pouco mais fortes.
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
  compasso(`temp_${nome}`, (b) => fig.notas.forEach(([n, q]) =>
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

// ---------- Tendência da temperatura: toca junto com a melodia e mostra o aquecimento ao
// longo das décadas (média de 11 anos, 4 níveis). Timbre de marimba (batida curta), diferente do drone
// do CO₂. Todos os níveis têm o MESMO ritmo: uma batida em cada tempo. O que muda é a nota, que
// "sobe de andar" pelas notas do acorde (as mais estáveis, que combinam com qualquer figura da melodia):
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

mkdirSync(SAIDA, { recursive: true });
for (const [nome, b] of Object.entries(arquivos)) writeFileSync(join(SAIDA, `${nome}.wav`), wav(b));
console.log(`OK: ${Object.keys(arquivos).length} sons provisórios em ${SAIDA} (loop = ${(N_LOOP / SR).toFixed(3)} s)`);
