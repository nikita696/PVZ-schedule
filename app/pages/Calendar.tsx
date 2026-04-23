import { useLocation } from 'react-router';
import { ExperimentalCalendarWorkspace } from '../components/calendar-experiment/ExperimentalCalendarWorkspace';
import { LegacyCalendarPageView } from './calendar/LegacyCalendarPage';

export default function CalendarPage() {
  const location = useLocation();
  const basePath = location.pathname.replace(/\/classic$/, '');
  const useClassicCalendar = location.pathname.startsWith('/admin/calendar');

  if (useClassicCalendar) {
    return <LegacyCalendarPageView showExperimentalBanner={false} />;
  }

  return <ExperimentalCalendarWorkspace classicHref={`${basePath}/classic`} />;
}
