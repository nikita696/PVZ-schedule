import { useLocation } from 'react-router';
import { ExperimentalCalendarWorkspace } from '../components/calendar-experiment/ExperimentalCalendarWorkspace';
import { LegacyCalendarPageView } from './calendar/LegacyCalendarPage';

export default function CalendarPage() {
  const location = useLocation();
  const isEmployeeCalendarRoute = location.pathname.startsWith('/employee/');

  if (isEmployeeCalendarRoute) {
    const basePath = location.pathname.replace(/\/classic$/, '');
    return <ExperimentalCalendarWorkspace classicHref={`${basePath}/classic`} />;
  }

  return <LegacyCalendarPageView />;
}
