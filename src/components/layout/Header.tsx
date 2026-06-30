import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Car, Users, LogOut, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

export const Header: React.FC = () => {
  const { user, isOperator, isAdmin, signOut } = useAuth();
  const canSwitchRole = isOperator || isAdmin;
  const location = useLocation();
  const isOperatorRoute = location.pathname.startsWith('/operator');
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const roleLinks = (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={`w-full justify-start min-h-11 ${
          !isOperatorRoute ? 'gradient-primary text-white' : ''
        }`}
        onClick={() => setMenuOpen(false)}
      >
        <Link to="/">
          <Users className="w-4 h-4 mr-2 shrink-0" />
          Passenger
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={`w-full justify-start min-h-11 ${
          isOperatorRoute ? 'gradient-primary text-white' : ''
        }`}
        onClick={() => setMenuOpen(false)}
      >
        <Link to="/operator">
          <Car className="w-4 h-4 mr-2 shrink-0" />
          Operator
        </Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-secondary-200 glass backdrop-blur-xl safe-top">
      <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base sm:text-xl font-bold text-gradient truncate">ShuttleBook</p>
            <p className="text-xs text-secondary-600 -mt-0.5 hidden sm:block truncate">
              Professional Transport
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {canSwitchRole && !isMobile && (
            <div className="flex items-center gap-1 bg-secondary-100 rounded-full p-1">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={`px-3 sm:px-4 py-2 rounded-full min-h-10 ${
                  !isOperatorRoute
                    ? 'gradient-primary text-white shadow-elevation'
                    : 'text-secondary-600'
                }`}
              >
                <Link to="/">
                  <Users className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Passenger</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={`px-3 sm:px-4 py-2 rounded-full min-h-10 ${
                  isOperatorRoute
                    ? 'gradient-primary text-white shadow-elevation'
                    : 'text-secondary-600'
                }`}
              >
                <Link to="/operator">
                  <Car className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Operator</span>
                </Link>
              </Button>
            </div>
          )}

          {user && (
            <>
              {!isMobile && (
                <span className="text-sm text-secondary-600 hidden lg:inline max-w-[140px] truncate">
                  {user.email}
                </span>
              )}
              {!isMobile ? (
                <Button variant="ghost" size="sm" className="min-h-10" onClick={() => signOut()}>
                  <LogOut className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              ) : (
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open menu">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(100vw-2rem,20rem)] safe-bottom">
                    <SheetHeader>
                      <SheetTitle className="text-left">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      {user.email && (
                        <p className="text-sm text-secondary-600 break-all">{user.email}</p>
                      )}
                      {canSwitchRole && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">
                            View as
                          </p>
                          {roleLinks}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full min-h-11"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign out
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
