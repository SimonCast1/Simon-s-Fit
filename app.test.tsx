import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, initDatabase, setSetting } from '../src/db';
import { commitHevy, previewHevy } from '../src/lib/actions';
import { AppProvider } from '../src/store';
import { App } from '../src/App';

const has = existsSync('tests/fixture-hevy.csv');
const csv = has ? readFileSync('tests/fixture-hevy.csv', 'utf-8') : '';
const nav = (h: string) => act(async () => { window.location.hash = h; await new Promise((r) => setTimeout(r, 30)); });
const mount = () => render(<AppProvider><App /></AppProvider>);

beforeAll(async () => {
  if (!has) return;
  await initDatabase();
  await commitHevy(await previewHevy(csv));
});

describe.skipIf(!has)('fluxo completo na interface', () => {
  it('início: mostra rotina do dia, semana e último treino importado', async () => {
    await nav('#/');
    mount();
    expect(await screen.findByText("Simon's Fit")).toBeTruthy();
    // sábado (hoje) não tem rotina => sugere pela ordem; o último treino importado é "Upper B"
    expect(await screen.findByText('Último treino')).toBeTruthy();
    expect(screen.getAllByText('Upper B').length).toBeGreaterThan(0);
    expect(screen.getByText('Começar treino')).toBeTruthy();
    // aviso de backup: há treinos e nunca se fez backup
    expect(screen.getByText('Faz um backup')).toBeTruthy();
  });

  it('treino: mostra o anterior, regista série, descanso, termina e guarda', async () => {
    const user = userEvent.setup();
    await nav('#/routines');
    mount();
    const title = await screen.findByText('Superior B');
    const card = title.closest('.card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /Começar treino/ }));

    // ecrã do treino
    expect(await screen.findByText('Supino Inclinado com Halteres')).toBeTruthy();
    expect(window.location.hash).toBe('#/active');

    // 1.ª linha do supino inclinado mostra o que fizeste da última vez: 22,5 × 12
    const firstCard = screen.getByText('Supino Inclinado com Halteres').closest('.ex-card') as HTMLElement;
    const rows = firstCard.querySelectorAll('.srow');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('.s-prev')!.textContent).toBe('22,5 × 12');
    expect(rows[1].querySelector('.s-prev')!.textContent).toBe('22,5 × 8');
    expect(rows[2].querySelector('.s-prev')!.textContent).toBe('22,5 × 7');
    // meta de dupla progressão (ainda não chegou a 12 em todas as séries)
    expect(within(firstCard).getByText(/Meta: 22,5 kg × 8/)).toBeTruthy();
    expect(within(firstCard).getByText(/tenta \+1 rep na mais fraca/)).toBeTruthy();
    // coluna "Meta" série a série e sem campo de RIR
    expect(rows[0].querySelector('.s-target')!.textContent).toBe('22,5 × 12');
    expect(rows[1].querySelector('.s-target')!.textContent).toBe('22,5 × 9');
    expect(rows[2].querySelector('.s-target')!.textContent).toBe('22,5 × 8');
    expect(firstCard.querySelector('input[aria-label="RIR"]')).toBeNull();
    expect(within(firstCard).getByText('Feito')).toBeTruthy();
    // alvo da rotina
    expect(within(firstCard).getByText(/^3 × 8–12$/)).toBeTruthy();

    // pull up (peso corporal): anterior = reps
    const pull = screen.getByText('Elevações (Barra Fixa)').closest('.ex-card') as HTMLElement;
    expect(pull.querySelectorAll('.srow')[0].querySelector('.s-prev')!.textContent).toBe('10');

    // concluir a 1.ª série sem escrever nada => usa os valores do anterior (22,5 × 12)
    await user.click(rows[0].querySelector('.s-check') as HTMLElement);
    await waitFor(async () => {
      const w = (await db.workouts.toArray()).find((x) => !x.endedAt)!;
      expect(w.exercises[0].sets[0]).toMatchObject({ done: true, weight: 22.5, reps: 12 });
    });
    // cronómetro de descanso apareceu
    expect(await screen.findByText('Descanso')).toBeTruthy();

    // escrever valores na 2.ª série (vírgula decimal) e concluir
    const kg = rows[1].querySelector('input[aria-label="kg"]') as HTMLInputElement;
    const reps = rows[1].querySelector('input[aria-label="reps"]') as HTMLInputElement;
    await user.clear(kg); await user.type(kg, '30,5');
    await user.clear(reps); await user.type(reps, '8');
    await user.click(rows[1].querySelector('.s-check') as HTMLElement);
    await waitFor(async () => {
      const w = (await db.workouts.toArray()).find((x) => !x.endedAt)!;
      expect(w.exercises[0].sets[1]).toMatchObject({ done: true, weight: 30.5, reps: 8 });
    });
    // 30,5 × 8 (1RM ≈ 38,6) bate o teu melhor de sempre (35 kg) => indicador de recorde
    await waitFor(() => expect(rows[1].querySelector('.s-idx svg')).toBeTruthy());
    expect(rows[0].querySelector('.s-idx svg')).toBeNull(); // a 1.ª série (22,5×12) não é recorde

    // terminar: as séries por concluir são descartadas
    await user.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(await screen.findByText(/2 séries concluídas\./)).toBeTruthy();
    expect(screen.getByText(/séries por concluir serão descartadas/)).toBeTruthy();
    const sheet = screen.getByRole('dialog');
    // alterações face à rotina: por defeito "só neste treino"
    expect(within(sheet).getByText('Alterações face à rotina')).toBeTruthy();
    expect(within(sheet).getAllByText(/Não fizeste/).length).toBeGreaterThan(0);
    expect(within(sheet).getByText('Supino Inclinado com Halteres: 3 → 2 séries')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Terminar' }));

    // resumo e análise do treino
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/done\/\d+$/));
    expect(await screen.findByRole('heading', { name: 'Treino concluído' })).toBeTruthy();
    expect(screen.getByText('O que está bem')).toBeTruthy();
    expect(screen.getByText('A melhorar')).toBeTruthy();
    // a rotina não mudou (só neste treino)
    const routineAfter = (await db.routines.toArray()).find((r) => r.name === 'Superior B')!;
    expect(routineAfter.items.length).toBeGreaterThan(5);
    expect(routineAfter.items[0].sets).toBe(3);
    await nav('#/workout/' + window.location.hash.split('/')[2]);
    const done = (await db.workouts.toArray()).filter((w) => w.endedAt && w.name === 'Superior B');
    expect(done).toHaveLength(1);
    expect(done[0].exercises).toHaveLength(1);
    expect(done[0].exercises[0].sets).toHaveLength(2);
    expect((await db.workouts.toArray()).filter((w) => !w.endedAt)).toHaveLength(0);
    expect((await db.settings.get('activeWorkoutId'))?.value).toBeNull();
    // o detalhe mostra o PR
    expect(await screen.findByText('PR')).toBeTruthy();
  });

  it('histórico lista o treino novo e estatísticas abrem sem erros', async () => {
    await nav('#/history');
    mount();
    expect(await screen.findByText('Superior B')).toBeTruthy();
    await nav('#/stats');
    expect(await screen.findByText('Séries por músculo (indiretas ×0,5). A marca vertical é o teu mínimo semanal.')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Força' }));
    expect(await screen.findByText('1RM estimado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Atividade' }));
    expect(await screen.findByText('Treinos por semana')).toBeTruthy();
  });

  it('calendário do histórico e resumo semanal abrem com os dados do Hevy', async () => {
    const user = userEvent.setup();
    await nav('#/history');
    mount();
    await user.click(await screen.findByRole('button', { name: 'Calendário' }));
    expect(await screen.findByText(/treinos neste mês/)).toBeTruthy();
    await nav('#/summary');
    expect(await screen.findByRole('heading', { name: 'Resumo semanal' })).toBeTruthy();
    expect(screen.getByText('O que está bem')).toBeTruthy();
    expect(screen.getByText('A melhorar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'prev' }));
    expect(screen.getByText('Séries por músculo')).toBeTruthy();
  });

  it('exercício: recordes e histórico com dados do Hevy', async () => {
    await nav('#/exercise/incline-bench-press-dumbbell');
    mount();
    expect(await screen.findByText('Supino Inclinado com Halteres')).toBeTruthy();
    expect(screen.getByText('Carga máxima')).toBeTruthy();
    expect(screen.getByText('1RM estimado')).toBeTruthy();
  });

  it('idioma inglês e rotinas editáveis', async () => {
    await setSetting('lang', 'en');
    await nav('#/routine/new');
    mount();
    expect(await screen.findByText('New routine')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give the routine a name')).toBeTruthy();
    await setSetting('lang', 'pt');
  });

  it('treino vazio, adicionar exercício e descartar', async () => {
    const user = userEvent.setup();
    await nav('#/');
    mount();
    await user.click(await screen.findByRole('button', { name: /Treino vazio/ }));
    expect(await screen.findByText('Adiciona o primeiro exercício')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Adicionar exercício/ }));
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByPlaceholderText('Pesquisar…'), 'prancha');
    await user.click(await within(dlg).findByText('Prancha'));
    await user.click(within(dlg).getByRole('button', { name: /Adicionar \(1\)/ }));
    expect(await screen.findByText('seg')).toBeTruthy(); // coluna de segundos (prancha = tempo)
    await user.click(screen.getByRole('button', { name: 'Descartar treino' }));
    const d = await screen.findByRole('dialog');
    await user.click(within(d).getByRole('button', { name: 'Descartar treino' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect((await db.workouts.toArray()).filter((w) => !w.endedAt)).toHaveLength(0);
  });
});
