import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useT } from '@/stores/uiStore';
import { HomePage } from '@/pages/HomePage';

const ExplorePage = lazy(() => import('@/pages/ExplorePage').then((module) => ({ default: module.ExplorePage })));
const SoundPage = lazy(() => import('@/pages/SoundPage').then((module) => ({ default: module.SoundPage })));
const CollectionsPage = lazy(() =>
  import('@/pages/CollectionsPage').then((module) => ({ default: module.CollectionsPage })),
);
const CollectionDetailPage = lazy(() =>
  import('@/pages/CollectionDetailPage').then((module) => ({ default: module.CollectionDetailPage })),
);
const RandomPage = lazy(() => import('@/pages/RandomPage').then((module) => ({ default: module.RandomPage })));
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then((module) => ({ default: module.LibraryPage })));
const JourneysPage = lazy(() => import('@/pages/JourneysPage').then((module) => ({ default: module.JourneysPage })));
const JourneyDetailPage = lazy(() =>
  import('@/pages/JourneyDetailPage').then((module) => ({ default: module.JourneyDetailPage })),
);
const MapDetailPage = lazy(() =>
  import('@/pages/MapDetailPage').then((module) => ({ default: module.MapDetailPage })),
);
const UploadPage = lazy(() => import('@/pages/UploadPage').then((module) => ({ default: module.UploadPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

function RouteFallback() {
  const t = useT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-[13px]" style={{ color: 'var(--text-mute)' }}>
      {t('common.loading')}
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/site/:domain" element={<Navigate to="/explore" replace />} />
          <Route path="/sound/:id" element={<SoundPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/random" element={<RandomPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/journeys" element={<JourneysPage />} />
          <Route path="/journeys/:id" element={<JourneyDetailPage />} />
          <Route path="/maps/:id" element={<MapDetailPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
