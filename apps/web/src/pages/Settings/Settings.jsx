import { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { User, Shield, Save, Camera, Loader2 } from 'lucide-react';
import { selectCurrentUser, userUpdated } from '@/features/auth/authSlice';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/axios';

export default function Settings() {
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState(user?.profile?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.profile?.avatarUrl || null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setErrorMsg('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const { data } = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedAvatar = data.data?.profile?.avatarUrl || objectUrl;
      setAvatarPreview(updatedAvatar);

      dispatch(
        userUpdated({
          profile: {
            ...user?.profile,
            avatarUrl: updatedAvatar,
          },
        })
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/users/me/profile', { displayName, bio });
      dispatch(
        userUpdated({
          profile: {
            ...user?.profile,
            displayName,
            bio,
          },
        })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-stage p-6 md:p-8">
      <div className="border-b border-border pb-6">
        <h1 className="font-display text-2xl font-bold text-paper">Account & Settings</h1>
        <p className="mt-1 text-sm text-paper-muted">
          Manage your personal profile, avatar photo, and preferences.
        </p>
      </div>

      <div className="mt-8 max-w-2xl space-y-8">
        <section className="surface rounded-2xl p-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <User className="h-5 w-5 text-ember" />
            <h2 className="font-display font-bold text-paper">Public Profile</h2>
          </div>

          <form onSubmit={handleSave} className="mt-6 space-y-5">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <Avatar name={user?.username} src={avatarPreview} size="lg" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  title="Change picture"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Add / Change picture'}
                </Button>
                <p className="mt-1.5 text-xs text-paper-muted">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm text-ember-hot">{errorMsg}</p>
            )}

            <Input
              label="Username"
              value={user?.username || ''}
              disabled
              helper="Your unique account handle."
            />

            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How friends see your name"
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-paper-muted">About Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="A short note about yourself..."
                className="w-full rounded-xl border border-border bg-stage-raised p-3 text-sm text-paper outline-none focus:border-ember"
              />
            </div>

            <Button type="submit" size="sm">
              <Save className="h-4 w-4" /> {saved ? 'Saved!' : 'Save changes'}
            </Button>
          </form>
        </section>

        <section className="surface rounded-2xl p-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Shield className="h-5 w-5 text-ember" />
            <h2 className="font-display font-bold text-paper">Privacy & Status</h2>
          </div>

          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-paper">Show online status & last seen</p>
                <p className="text-xs text-paper-muted">Allow friends to see when you're available for watch parties.</p>
              </div>
              <input
                type="checkbox"
                checked={showLastSeen}
                onChange={(e) => setShowLastSeen(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-ember"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
