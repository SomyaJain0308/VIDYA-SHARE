import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import LegalDocumentPage from './components/LegalDocumentPage';
import MarketplaceApp from './components/MarketplaceApp';
import { LEGAL_DOCUMENTS, normalizeLegalPath } from './content/legalDocuments';
import { trackAppOpen, trackPageVisit } from './utils/analytics';

export default function App() {
  const location = useLocation();
  const hasTrackedRouteRef = useRef(false);
  const hasTrackedAppOpenRef = useRef(false);
  const currentPath = normalizeLegalPath(location.pathname);
  const isLegalPage = Boolean(LEGAL_DOCUMENTS[currentPath]);
  const isListingPage = /^\/listing\/[^/]+\/?$/.test(location.pathname || '');
  const pageType = isLegalPage ? 'legal' : isListingPage ? 'listing_detail' : 'marketplace';

  useEffect(() => {
    if (hasTrackedAppOpenRef.current) return;
    hasTrackedAppOpenRef.current = true;
    trackAppOpen({
      entryPath: `${location.pathname || '/'}${location.search || ''}`,
      pageType,
    });
  }, [location.pathname, location.search, pageType]);

  useEffect(() => {
    const routeKey = `${location.pathname || '/'}${location.search || ''}`;
    if (!hasTrackedRouteRef.current) {
      hasTrackedRouteRef.current = true;
      return;
    }
    trackPageVisit({
      path: routeKey,
      pageType,
      routeName: currentPath || pageType,
    });
  }, [currentPath, location.pathname, location.search, pageType]);

  return (
    <AppErrorBoundary>
      {isLegalPage ? <LegalDocumentPage path={currentPath} /> : <MarketplaceApp />}
    </AppErrorBoundary>
  );
}
