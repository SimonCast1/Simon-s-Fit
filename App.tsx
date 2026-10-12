import { useEffect } from 'react';
import { useApp } from './store';
import { go, useRoute } from './router';
import { Icon, ToastProvider } from './components/ui';
import { RestBar } from './components/RestBar';
import { Home } from './screens/Home';
import { Routines } from './screens/Routines';
import { RoutineEditor } from './screens/RoutineEditor';
import { Exercises } from './screens/Exercises';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { History } from './screens/History';
import { WorkoutDetail } from './screens/WorkoutDetail';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { Stats } from './screens/Stats';
import { Summary } from './screens/Summary';
import { WorkoutDone } from './screens/WorkoutDone';
import { Settings } from './screens/Settings';
import { ImportShared } from './screens/ImportShared';

const TABS = [
  { path: '/', key: 'home', icon: 'home', label: { pt: 'Início', en: 'Home' } },
  { path: '/routines', key: 'routines', icon: 'list', label: { pt: 'Rotinas', en: 'Routines' } },
  { path: '/exercises', key: 'exercises', icon: 'dumbbell', label: { pt: 'Exercícios', en: 'Exercises' } },
  { path: '/history', key: 'history', icon: 'clock', label: { pt: 'Histórico', en: 'History' } },
  { path: '/stats', key: 'stats', icon: 'chart', label: { pt: 'Estatísticas', en: 'Stats' } }
] as const;

function Redirect({ to }: { to: string }) {
  useEffect(() => { go(to, true); }, [to]);
  return null;
}

function Screen() {
  const { parts, query } = useRoute();
  const { active } = useApp();
  const [a, b] = parts;
  const num = Number(b);
  switch (a) {
    case undefined: return <Home />;
    case 'routines': return <Routines />;
    case 'routine': return <RoutineEditor key={b} id={b === 'new' ? 'new' : num} />;
    case 'exercises': return <Exercises />;
    case 'exercise': return <ExerciseDetail key={b} id={decodeURIComponent(b)} />;
    case 'history': return <History />;
    case 'workout': return <WorkoutDetail key={b} id={num} />;
    case 'edit': return <WorkoutScreen key={`e${b}`} id={num} editing />;
    case 'active': return active ? <WorkoutScreen key={active.id} id={active.id!} /> : <Redirect to="/" />;
    case 'stats': return <Stats />;
    case 'summary': return <Summary />;
    case 'done': return <WorkoutDone key={b} id={num} />;
    case 'settings': return <Settings />;
    case 'import': return <ImportShared data={query.get('d') ?? ''} />;
    default: return <Redirect to="/" />;
  }
}

export function App() {
  const { lang, rest } = useApp();
  const { parts } = useRoute();
  const a = parts[0];
  const inWorkout = a === 'active' || a === 'edit';
  const tabKey = a === undefined ? 'home' : a === 'routine' ? 'routines' : a === 'exercise' ? 'exercises' : a === 'workout' ? 'history' : a === 'summary' ? 'stats' : a === 'done' ? 'history' : a;

  useEffect(() => { window.scrollTo(0, 0); }, [a, parts[1]]);

  return (
    <ToastProvider>
      <div className={`app ${rest.endsAt ? 'has-rest' : ''} ${inWorkout ? 'no-tabs' : ''}`}>
        <Screen />
        <RestBar />
        {!inWorkout && (
          <nav className="tabbar">
            {TABS.map((tab) => (
              <button key={tab.key} className={tabKey === tab.key ? 'on' : ''} onClick={() => go(tab.path)}>
                <Icon name={tab.icon} size={22} />
                <span>{tab.label[lang]}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </ToastProvider>
  );
}
