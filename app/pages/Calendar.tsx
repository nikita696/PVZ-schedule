import { useLocation } from 'react-router';
import { ExperimentalCalendarWorkspace } from '../components/calendar-experiment/ExperimentalCalendarWorkspace';

export default function CalendarPage() {
  const location = useLocation();
  const basePath = location.pathname.replace(/\/classic$/, '');

  return <ExperimentalCalendarWorkspace classicHref={`${basePath}/classic`} />;
}
