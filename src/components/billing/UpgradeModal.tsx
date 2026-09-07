import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button, Modal } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function UpgradeModal({
  open,
  onClose,
  title = 'Upgrade to keep recording trades',
  message = "You've used all 30 free trade entries. Upgrade your membership to continue recording trades — your existing trades stay exactly where they are.",
}: Props) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onClose();
              navigate(ROUTES.membership);
            }}
          >
            View Membership Plans
          </Button>
        </div>
      </div>
    </Modal>
  );
}
