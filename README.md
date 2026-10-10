# Simon's Fit

Tracker de treinos pessoal, feito à medida do plano dos documentos de referência (hipertrofia, nutrição, suplementação, recuperação). É uma **PWA**: instala-se no iPhone pelo Safari, funciona **offline** e guarda **tudo no próprio telemóvel** (sem contas, sem servidor, 0 €).

## O que faz

**Treino**
- Em cada série mostra sempre o que fizeste **da última vez** no mesmo exercício (carga × reps). Tocar no valor copia-o.
- Concluir uma série sem escrever nada usa os valores previstos (a meta ou o anterior): um toque por série.
- Cronómetro de descanso por exercício (compostos 150 s, isolamento 90 s, editável), com som/vibração.
- Séries de aquecimento, RIR por série, notas, supersérie, substituir/reordenar exercícios, treino vazio.
- O treino em curso sobrevive a fechar a app ou a bloquear o telemóvel.

**Alertas discretos durante o treino** (regras dos documentos)
- **Dupla progressão:** quando todas as séries chegam ao topo da faixa de reps (com o RIR alvo), sugere subir a carga pelo incremento do exercício; caso contrário mostra a meta para bater a série mais fraca.
- **Volume semanal por músculo** (contagem fracionada: indiretas = 0,5) junto de cada exercício, ex. `Peito 7/10`.
- **Estagnação:** 4 sessões (≥3 semanas) sem bater o teu melhor → sugere +2 séries.
- **Deload:** força a descer em ≥3 exercícios (≥40 %) durante 2 semanas seguidas.
- **PRs:** carga máxima, 1RM estimado (Epley) e repetições (peso corporal).

**Resto**
- Rotinas pré-carregadas do documento 1: Superior A, Inferior, Superior B, Full body (com supersérie bíceps+tríceps). Sugere a do dia (seg/ter/qua/sex).
- Biblioteca de 76 exercícios (PT-PT e EN), personalizável: músculo principal/secundários, incremento, faixa de reps, descanso.
- Histórico, detalhe, repetir/editar treino, partilhar como texto.
- Estatísticas: volume semanal por músculo vs. mínimo, evolução de força por exercício, treinos por semana.
- **Importar do Hevy** (CSV) sem duplicar se importares duas vezes; deteta aquecimentos (opcional).
- **Partilha de rotinas** por link ou QR code.
- **Backup/restauro** em JSON.
- Português (PT) e inglês.

## Publicar (grátis, GitHub Pages)

1. No GitHub, cria um repositório **público** chamado `simons-fit` (o Pages gratuito exige repositório público; a app não contém dados teus, esses ficam no telemóvel).
2. Envia os ficheiros deste projeto para o repositório (ramo `main`). Atenção: a pasta `.github` é oculta e o arrastar do browser pode ignorá-la. Se faltar, em *Add file → Create new file* cria `.github/workflows/deploy.yml` e cola o conteúdo do ficheiro com o mesmo nome deste projeto.
3. Em **Settings → Pages → Build and deployment → Source**, escolhe **GitHub Actions**.
4. Em **Actions** aguarda o fluxo "Publicar no GitHub Pages" ficar verde (~1–2 min). A app fica em `https://<o-teu-utilizador>.github.io/simons-fit/`.

## Instalar no iPhone

1. Abre o link **no Safari**.
2. Partilhar → **Adicionar ao ecrã principal**.
3. Abre sempre pelo ícone. É isto que torna os dados duráveis e a app offline. Se usares só o separador do Safari, o iOS pode apagar os dados do site.

## Importar o histórico do Hevy

No telemóvel: **Definições → Importar do Hevy (CSV)** e escolhe o ficheiro exportado do Hevy. Vês uma pré-visualização (treinos novos, séries, exercícios novos) antes de confirmar.

A opção **Detetar aquecimentos** marca como aquecimento as séries iniciais com ≤65 % da carga máxima do exercício nessa sessão (no teu CSV: 76 séries, ex. 15 kg × 12 antes do trabalho a 25 kg). Deixam de contar para volume, recordes e progressão. Podes desligar antes de importar.

## Backup (importante)

Os dados vivem **só** no telemóvel. Em **Definições → Exportar backup** guarda o ficheiro `.json` em Ficheiros/iCloud. A app lembra-te quando passa mais de uma semana sem backup. Para trocar de telemóvel: **Restaurar backup**.

## Limitações conhecidas (inerentes a ser PWA e 0 €)

- Sem widget, Apple Watch nem Apple Health (exigem app nativa e conta Apple Developer de 99 $/ano).
- No iOS, o som/vibração do fim do descanso só funcionam com a app aberta (o tempo continua certo ao voltares à app). Não há notificações com a app fechada.
- Sem sincronização entre dispositivos: cada telemóvel tem os seus dados. Para passar uma rotina a outra pessoa usa o link/QR.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local
npm run build    # verificação de tipos + build de produção (dist/)
npm test         # testes (lógica, base de dados, interface)
```

Os testes que usam dados reais precisam do teu CSV em `tests/fixture-hevy.csv` (ignorado pelo git de propósito, é pessoal). Sem ele esses testes são saltados.

**Stack:** React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa (service worker), SVG próprio para gráficos.

```
src/
  lib/calc.ts      dupla progressão, volume fracionado, PRs, estagnação, deload
  lib/hevy.ts      parser do CSV do Hevy (puro, testável)
  lib/actions.ts   operações na base de dados, importação, backup
  lib/share.ts     partilha de rotinas por link/QR
  data/            biblioteca de exercícios e rotinas iniciais
  screens/         ecrãs   components/   peças reutilizáveis
```

## Ajustar o comportamento

- **Incrementos, faixas de reps e descanso:** em *Exercícios → (exercício) → Editar*.
- **Mínimos semanais por músculo** (avisos e estatísticas): em *Definições*.
- **Rotinas:** em *Rotinas* (editar séries, reps, RIR, dias, supersérie).
