import { ShieldCheck, UserCog } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { createOwnerAdminClaimRemote } from '../data/appRepository';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { currentUserSummary, updateCurrentUserName, refreshData } = useApp();
  const [displayName, setDisplayName] = useState(currentUserSummary?.displayName ?? '');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimDisplayName, setClaimDisplayName] = useState('Татьяна');
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'profile' | 'claim' | null>(null);

  useEffect(() => {
    setDisplayName(currentUserSummary?.displayName ?? '');
  }, [currentUserSummary?.displayName]);

  const handleDisplayNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('profile');
    const result = await updateCurrentUserName(displayName);
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message);
    await refreshData();
  };

  const handleClaimSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('claim');
    const result = await createOwnerAdminClaimRemote(claimEmail, claimDisplayName);
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setPendingClaimId(result.data.claimId);
    toast.success(result.message);
  };

  return (
    <div className="bg-stone-50">
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-2">
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="h-5 w-5 text-orange-600" />
              {t('Профиль', 'Profile')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleDisplayNameSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="settings-display-name">{t('Имя в интерфейсе', 'Display name')}</Label>
                <Input
                  id="settings-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={busy !== null}
                  required
                />
              </div>
              <Button type="submit" disabled={busy !== null} className="bg-orange-600 hover:bg-orange-500">
                {busy === 'profile' ? t('Сохраняю...', 'Saving...') : t('Сохранить имя', 'Save name')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-orange-600" />
              {t('Передача владельца', 'Owner transfer')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleClaimSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="claim-email">{t('Email нового администратора', 'New admin email')}</Label>
                <Input
                  id="claim-email"
                  type="email"
                  value={claimEmail}
                  onChange={(event) => setClaimEmail(event.target.value)}
                  disabled={busy !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-display-name">{t('Имя после передачи', 'Name after transfer')}</Label>
                <Input
                  id="claim-display-name"
                  value={claimDisplayName}
                  onChange={(event) => setClaimDisplayName(event.target.value)}
                  disabled={busy !== null}
                  required
                />
              </div>
              <Button type="submit" disabled={busy !== null} className="bg-orange-600 hover:bg-orange-500">
                <ShieldCheck className="h-4 w-4" />
                {busy === 'claim' ? t('Создаю...', 'Creating...') : t('Создать передачу', 'Create transfer')}
              </Button>
            </form>

            {pendingClaimId ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {t('Заявка создана:', 'Claim created:')} {pendingClaimId}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
