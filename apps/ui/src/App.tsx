import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
  Textarea,
  VStack,
  useToast
} from '@chakra-ui/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate
} from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

interface AuthenticatedUser {
  id: string;
  email: string;
  lastLoginAt: string | null;
}

type PromptStatus = 'Pending' | 'Building' | 'Ready' | 'Failed';

interface PromptSummary {
  id: string;
  title: string;
  prompt: string;
  status: PromptStatus;
  updatedAt: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        credentials: 'include'
      });

      if (!response.ok) {
        setStatus('unauthenticated');
        setUser(null);
        return;
      }

      const payload = (await response.json()) as { user: AuthenticatedUser | null };
      if (!payload.user) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      setUser(payload.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const refreshCsrfToken = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Unable to obtain CSRF token');
    }

    const payload = (await response.json()) as { csrfToken: string };
    setCsrfToken(payload.csrfToken);
    return payload.csrfToken;
  }, []);

  const ensureCsrfToken = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }

    return refreshCsrfToken();
  }, [csrfToken, refreshCsrfToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        if (response.status === 403) {
          await refreshCsrfToken().catch(() => undefined);
        }
        let message = 'Login failed';
        try {
          const payload = await response.json();
          message = payload.message ?? message;
        } catch {
          // ignore decoding error
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { email: string; csrfToken?: string };
      if (payload.csrfToken) {
        setCsrfToken(payload.csrfToken);
      }

      await refreshSession();
    },
    [ensureCsrfToken, refreshCsrfToken, refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrf
        },
        credentials: 'include'
      });

      if (!response.ok) {
        let message = 'Logout failed';
        try {
          const payload = await response.json();
          message = payload.message ?? message;
        } catch {
          // ignore decode errors
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { csrfToken?: string };
      if (payload.csrfToken) {
        setCsrfToken(payload.csrfToken);
      }
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [ensureCsrfToken]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        await refreshCsrfToken().catch(() => undefined);
        await refreshSession();
      } finally {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshCsrfToken, refreshSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      logout,
      refreshSession
    }),
    [status, user, login, logout, refreshSession]
  );

  if (!isBootstrapped) {
    return <FullScreenLoader />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function LoginPage() {
  const { login, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast({
        title: 'Welcome back!',
        description: `Authenticated as ${email}`,
        status: 'success'
      });
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected login error';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxW="sm" py={24}>
      <Box borderWidth="1px" borderRadius="lg" p={8} boxShadow="lg">
        <VStack spacing={6} align="stretch">
          <Heading size="lg" textAlign="center">
            Rapid Prototyper Login
          </Heading>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <FormControl id="email">
                <FormLabel>Email address</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </FormControl>
              <FormControl id="password">
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••"
                  required
                />
              </FormControl>
              {error ? (
                <Alert status="error">
                  <AlertIcon />
                  {error}
                </Alert>
              ) : null}
              <Button type="submit" colorScheme="purple" isLoading={isSubmitting} loadingText="Signing in">
                Sign In
              </Button>
            </VStack>
          </form>
        </VStack>
      </Box>
    </Container>
  );
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [prompts, setPrompts] = useState<PromptSummary[]>(() => [
    {
      id: '3',
      title: 'Landing hero',
      prompt: 'Create a hero layout for a marketing page',
      status: 'Ready',
      updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: '2',
      title: 'Pricing cards',
      prompt: 'Generate a pricing section with three tiers',
      status: 'Building',
      updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
      id: '1',
      title: 'Auth modal',
      prompt: 'Design an authentication modal with OAuth buttons',
      status: 'Pending',
      updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString()
    }
  ]);
  const toast = useToast();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({
        title: 'Signed out',
        description: 'You have been logged out securely.',
        status: 'info'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to log out';
      toast({
        title: 'Logout failed',
        description: message,
        status: 'error'
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const lastLoginText = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString()
    : 'First login pending';

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [prompts]
  );

  const handlePromptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promptText.trim()) {
      return;
    }

    setIsSubmittingPrompt(true);
    try {
      const newPrompt: PromptSummary = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        title: promptText.slice(0, 32) || 'Untitled prompt',
        prompt: promptText,
        status: 'Pending',
        updatedAt: new Date().toISOString()
      };
      setPrompts((current) => [newPrompt, ...current]);
      setPromptText('');
      toast({
        title: 'Prompt submitted',
        description: 'Status will update automatically.',
        status: 'info'
      });
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  return (
    <>
      <AppHeader user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <Container maxW="4xl" py={12}>
        <Stack spacing={10}>
          <Stack spacing={3}>
            <Alert status="success">
              <AlertIcon />
              Logged in as {user?.email} — last login {lastLoginText}
            </Alert>
          </Stack>

          <Box as="form" onSubmit={handlePromptSubmit} borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel textTransform="uppercase" fontSize="sm" letterSpacing="wide">
                  Describe your prototype
                </FormLabel>
                <Textarea
                  placeholder="Example: Build a dashboard with status badges and quick actions…"
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  minH="120px"
                />
              </FormControl>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.500">
                  Codex will generate UI code for each submitted description.
                </Text>
                <Button
                  type="submit"
                  colorScheme="purple"
                  isLoading={isSubmittingPrompt}
                  loadingText="Submitting"
                  isDisabled={!promptText.trim()}
                >
                  Submit Prompt
                </Button>
              </HStack>
            </VStack>
          </Box>

          <Stack spacing={4}>
            <HStack justify="space-between">
              <Heading size="md">Prompt history</Heading>
              <Text fontSize="sm" color="gray.500">
                Showing newest first
              </Text>
            </HStack>
            <Divider />
            <VStack spacing={4} align="stretch">
              {sortedPrompts.length === 0 ? (
                <Box borderWidth="1px" borderRadius="md" p={6} textAlign="center" color="gray.500">
                  No prompts yet. Describe your prototype to get started.
                </Box>
              ) : (
                sortedPrompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)
              )}
            </VStack>
          </Stack>
        </Stack>
      </Container>
    </>
  );
}

function AppHeader({
  user,
  onLogout,
  isLoggingOut
}: {
  user: AuthenticatedUser | null;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
}) {
  const initial = user?.email?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <Box borderBottomWidth="1px" bg="gray.50">
      <Container maxW="6xl">
        <HStack justify="space-between" py={2}>
          <Heading size="sm" letterSpacing="wide">
            Rapid Prototyper
          </Heading>
          <HStack spacing={3} align="center">
            <Box
              w="32px"
              h="32px"
              borderRadius="full"
              bg="purple.500"
              color="white"
              fontWeight="bold"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {initial}
            </Box>
            <Text display={{ base: 'none', sm: 'block' }} fontSize="sm">
              {user?.email}
            </Text>
            <Button size="sm" variant="outline" onClick={onLogout} isLoading={isLoggingOut}>
              Logout
            </Button>
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}

function PromptCard({ prompt }: { prompt: PromptSummary }) {
  const isReady = prompt.status === 'Ready';
  const badgeColor = {
    Pending: 'gray',
    Building: 'orange',
    Ready: 'green',
    Failed: 'red'
  }[prompt.status];

  return (
    <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
      <Stack spacing={3}>
        <HStack justify="space-between" align="flex-start">
          <VStack spacing={0} align="flex-start">
            <Heading size="sm">{prompt.title}</Heading>
            <Text fontSize="xs" color="gray.500">
              Updated {new Date(prompt.updatedAt).toLocaleString()}
            </Text>
          </VStack>
          <Badge colorScheme={badgeColor} textTransform="capitalize" px={2} py={1} borderRadius="md">
            {prompt.status}
          </Badge>
        </HStack>
        <Text color="gray.700">{prompt.prompt}</Text>
        <HStack justify="flex-end">
          <Button colorScheme="purple" size="sm" isDisabled={!isReady}>
            View
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
}

function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function FullScreenLoader() {
  return (
    <Center minH="100vh">
      <Spinner size="xl" />
    </Center>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
