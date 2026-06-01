import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { GameScanPage } from './pages/GameScanPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { NetworkSetupPage } from './pages/NetworkSetupPage';
import { RecommendationPage } from './pages/RecommendationPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { scanGames } from './api/tauri';
import type { GameSummary } from './types/game';

type Page = 'home' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();

  useEffect(() => {
    scanGames().then(setGames).catch(() => setGames([]));
  }, []);

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'home' && <HomePage onNavigate={setPage} />}
      {page === 'scan' && (
        <GameScanPage
          games={games}
          onSelectGame={(id) => {
            setSelectedGameId(id);
            setPage('detail');
          }}
        />
      )}
      {page === 'detail' && <GameDetailPage gameId={selectedGameId} onNext={() => setPage('network')} />}
      {page === 'network' && <NetworkSetupPage onNext={() => setPage('recommendation')} />}
      {page === 'recommendation' && <RecommendationPage gameId={selectedGameId} />}
      {page === 'diagnostics' && <DiagnosticsPage />}
    </Layout>
  );
}
