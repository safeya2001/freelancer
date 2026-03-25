import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  BellIcon, ChatBubbleLeftIcon, ChevronDownIcon,
  Bars3Icon, XMarkIcon, UserCircleIcon,
  WalletIcon,
  ArrowRightStartOnRectangleIcon,
  Squares2X2Icon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import clsx from 'clsx';

export default function Navbar() {
  const { t } = useTranslation('common');
  const { user, profile, isAuthenticated, isAdmin, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add shadow when scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [router.pathname]);

  const navLinks = [
    { href: '/gigs',      label: t('nav.gigs') },
    { href: '/projects',  label: t('nav.projects') },
    ...(isAuthenticated ? [{ href: '/dashboard', label: t('nav.dashboard'), Icon: Squares2X2Icon }] : []),
    ...(isAdmin ? [{ href: '/admin', label: t('nav.admin'), Icon: ShieldCheckIcon }] : []),
  ];

  const isActive = (href: string) => router.pathname.startsWith(href);

  return (
    <nav
      className={clsx(
        'sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b transition-all duration-200',
        scrolled ? 'border-gray-200 shadow-sm' : 'border-gray-100',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white font-black text-sm tracking-tight">D</span>
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-black text-gray-900 text-base tracking-tight">
                Dopa<span className="text-primary-600">Work</span>
              </span>
              <span className="text-[9px] text-gray-400 font-medium uppercase tracking-widest">Jordan</span>
            </div>
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                {link.Icon && <link.Icon className="w-4 h-4" />}
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <Link
                  href="/dashboard?tab=notifications"
                  className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title={t('nav.notifications')}
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Messages */}
                <Link
                  href="/dashboard?tab=messages"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title={t('nav.messages')}
                >
                  <ChatBubbleLeftIcon className="w-5 h-5" />
                </Link>

                {/* User dropdown */}
                <Menu as="div" className="relative">
                  <Menu.Button className="flex items-center gap-2 ps-1 pe-2 py-1 rounded-xl hover:bg-gray-100 transition-colors group">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-7 h-7 rounded-lg object-cover ring-2 ring-primary-100" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-bold text-xs">
                          {(profile?.full_name_en || user?.email || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[110px] truncate">
                      {profile?.full_name_en || user?.email}
                    </span>
                    <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </Menu.Button>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="opacity-0 scale-95 translate-y-1"
                    enterTo="opacity-100 scale-100 translate-y-0"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute end-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 focus:outline-none">
                      {/* User info header */}
                      <div className="px-4 py-2.5 border-b border-gray-50">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {profile?.full_name_en || user?.email}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                      </div>

                      <Menu.Item>
                        {({ active }) => (
                          <Link href={`/profile/${user?.id}`}
                            className={clsx('flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700', active && 'bg-gray-50')}>
                            <UserCircleIcon className="w-4 h-4 text-gray-400" />
                            {t('nav.profile')}
                          </Link>
                        )}
                      </Menu.Item>

                      <Menu.Item>
                        {({ active }) => (
                          <Link href="/dashboard?tab=wallet"
                            className={clsx('flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700', active && 'bg-gray-50')}>
                            <WalletIcon className="w-4 h-4 text-gray-400" />
                            {t('nav.wallet')}
                          </Link>
                        )}
                      </Menu.Item>

                      <div className="my-1 border-t border-gray-100" />

                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={logout}
                            className={clsx('w-full text-start flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600', active && 'bg-red-50')}
                          >
                            <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                            {t('nav.logout')}
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login"
                  className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/auth/register"
                  className="text-sm font-semibold bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-xl transition-colors shadow-sm">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors ms-1"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-100 space-y-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors',
                  isActive(link.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                {link.Icon && <link.Icon className="w-4 h-4" />}
                {link.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <div className="pt-2 border-t border-gray-100 mt-2">
                <Link href="/auth/login"
                  className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">
                  {t('nav.login')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
