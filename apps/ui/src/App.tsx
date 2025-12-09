import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useToast
} from '@chakra-ui/react';
import * as Babel from '@babel/standalone';
import React, {
  ComponentType,
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
  Link as RouterLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams
} from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

interface AuthenticatedUser {
  id: string;
  email: string;
  lastLoginAt: string | null;
}

type PromptStatus = 'pending' | 'building' | 'ready' | 'failed';

interface PromptEventSummary {
  id: string;
  level: 'info' | 'error';
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

interface PromptSummary {
  id: string;
  title: string;
  promptText: string;
  status: PromptStatus;
  updatedAt: string;
  previewSlug: string | null;
  renderError: string | null;
  events: PromptEventSummary[];
}

interface PromptDetail extends PromptSummary {
  createdAt: string;
  jsxSource: string | null;
  compiledJs: string | null;
  sandboxConfig: Record<string, unknown> | null;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getCsrfToken: () => Promise<string>;
  refreshCsrfToken: () => Promise<string>;
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
      refreshSession,
      getCsrfToken: ensureCsrfToken,
      refreshCsrfToken
    }),
    [status, user, login, logout, refreshSession, ensureCsrfToken, refreshCsrfToken]
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

function useLogoutAction() {
  const { logout } = useAuth();
  const toast = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
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
  }, [logout, toast]);

  return { handleLogout, isLoggingOut };
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
  const { user, getCsrfToken, refreshCsrfToken } = useAuth();
  const { handleLogout, isLoggingOut } = useLogoutAction();
  const [promptText, setPromptText] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [promptLoadError, setPromptLoadError] = useState<string | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const loadPrompts = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoadingPrompts(true);
      setPromptLoadError(null);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/prompts`, {
        credentials: 'include'
      });
      if (!response.ok) {
        let message = 'Unable to load prompt history';
        try {
          const payload = await response.json();
          message = payload.message ?? message;
        } catch {
          // ignore decoder errors
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { prompts: PromptSummary[] };
      setPrompts(payload.prompts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load prompt history';
      if (!silent) {
        setPromptLoadError(message);
      } else {
        console.warn('[prompts] background refresh failed', message);
      }
    } finally {
      if (!silent) {
        setIsLoadingPrompts(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setPrompts([]);
      setPromptLoadError(null);
      setIsLoadingPrompts(false);
      return;
    }
    loadPrompts();
  }, [user, loadPrompts]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const interval = window.setInterval(() => {
      loadPrompts({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [user, loadPrompts]);

  const handleViewPrompt = useCallback(
    (promptId: string) => {
      navigate(`/prompts/${promptId}`);
    },
    [navigate]
  );

  const lastLoginText = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString()
    : 'First login pending';

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [prompts]
  );

  const handlePromptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promptText.trim()) {
      return;
    }

    setIsSubmittingPrompt(true);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`${API_BASE_URL}/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        credentials: 'include',
        body: JSON.stringify({ promptText })
      });

      if (!response.ok) {
        if (response.status === 403) {
          await refreshCsrfToken().catch(() => undefined);
        }
        let message = 'Unable to submit prompt';
        try {
          const payload = await response.json();
          message = payload.message ?? message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { prompt: PromptSummary };
      setPrompts((current) => [payload.prompt, ...current]);
      setPromptText('');
      toast({
        title: 'Prompt submitted',
        description: 'Status will update automatically.',
        status: 'info'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit prompt';
      toast({
        title: 'Prompt submission failed',
        description: message,
        status: 'error'
      });
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    setDeletingPromptId(promptId);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`${API_BASE_URL}/prompts/${promptId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrf
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          await refreshCsrfToken().catch(() => undefined);
        }
        let message = 'Unable to delete prompt';
        try {
          const payload = await response.json();
          message = payload.message ?? message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      setPrompts((current) => current.filter((prompt) => prompt.id !== promptId));
      toast({
        title: 'Prompt deleted',
        status: 'success'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete prompt';
      toast({
        title: 'Delete failed',
        description: message,
        status: 'error'
      });
    } finally {
      setDeletingPromptId(null);
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
              {promptLoadError ? (
                <Alert status="error">
                  <AlertIcon />
                  {promptLoadError}
                </Alert>
              ) : null}
              {isLoadingPrompts ? (
                <Center py={8}>
                  <Spinner />
                </Center>
              ) : sortedPrompts.length === 0 ? (
                <Box borderWidth="1px" borderRadius="md" p={6} textAlign="center" color="gray.500">
                  No prompts yet. Describe your prototype to get started.
                </Box>
              ) : (
                sortedPrompts.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onDelete={handleDeletePrompt}
                    isDeleting={deletingPromptId === prompt.id}
                    onView={handleViewPrompt}
                  />
                ))
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

const STATUS_META: Record<
  PromptStatus,
  { label: string; color: string; description: string }
> = {
  pending: {
    label: 'Pending',
    color: 'gray',
    description: 'Queued for the Codex worker'
  },
  building: {
    label: 'Building',
    color: 'orange',
    description: 'Codex + Babel are generating the preview'
  },
  ready: {
    label: 'Ready',
    color: 'green',
    description: 'Preview artifacts stored and ready to view'
  },
  failed: {
    label: 'Failed',
    color: 'red',
    description: 'Build failed — review logs for details'
  }
};

function PromptStatusBadge({ status }: { status: PromptStatus }) {
  const meta = STATUS_META[status];
  return (
    <Tooltip label={meta.description} hasArrow placement="top">
      <Badge colorScheme={meta.color} px={2} py={1} borderRadius="md">
        {meta.label}
      </Badge>
    </Tooltip>
  );
}

function PromptEventList({
  events,
  emptyLabel
}: {
  events: PromptEventSummary[];
  emptyLabel: string;
}) {
  if (!events || events.length === 0) {
    return (
      <Text fontSize="xs" color="gray.500">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack spacing={1}>
      {events.map((event) => (
        <HStack key={event.id} spacing={2} align="baseline">
          <Badge
            colorScheme={event.level === 'error' ? 'red' : 'purple'}
            textTransform="uppercase"
            fontSize="0.6rem"
          >
            {event.level.toUpperCase()}
          </Badge>
          <Text fontSize="xs" color="gray.600">
            {new Date(event.createdAt).toLocaleTimeString()} — {event.message}
          </Text>
        </HStack>
      ))}
    </Stack>
  );
}

function PromptCard({
  prompt,
  onDelete,
  onView,
  isDeleting
}: {
  prompt: PromptSummary;
  onDelete: (promptId: string) => Promise<void> | void;
  onView: (promptId: string) => void;
  isDeleting: boolean;
}) {
  const isReady = prompt.status === 'ready';
  const previewTooltip = isReady
    ? 'Open details and preview'
    : 'View details; preview unlocks once the worker marks this prompt Ready';

  return (
    <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
      <Stack spacing={4}>
        <HStack justify="space-between" align="flex-start">
          <VStack spacing={0} align="flex-start">
            <Heading size="sm">{prompt.title}</Heading>
            <Text fontSize="xs" color="gray.500">
              Updated {new Date(prompt.updatedAt).toLocaleString()}
            </Text>
          </VStack>
          <PromptStatusBadge status={prompt.status} />
        </HStack>
        <Text color="gray.700">{prompt.promptText}</Text>
        <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={1}>
            Codex activity
          </Text>
          <PromptEventList events={prompt.events} emptyLabel="Waiting for Codex worker updates…" />
        </Box>
        {prompt.renderError ? (
          <Alert status="error" variant="left-accent">
            <AlertIcon />
            {prompt.renderError}
          </Alert>
        ) : null}
        <HStack justify="flex-end" spacing={2}>
          <Button
            variant="ghost"
            colorScheme="red"
            size="sm"
            onClick={() => onDelete(prompt.id)}
            isDisabled={isDeleting}
            isLoading={isDeleting}
          >
            Delete
          </Button>
          <Tooltip label={previewTooltip} hasArrow shouldWrapChildren placement="top" isDisabled={isReady}>
            <Button colorScheme="purple" size="sm" onClick={() => onView(prompt.id)}>
              View
            </Button>
          </Tooltip>
        </HStack>
      </Stack>
    </Box>
  );
}

function PromptDetailPage() {
  const { user } = useAuth();
  const { handleLogout, isLoggingOut } = useLogoutAction();
  const { promptId } = useParams<{ promptId?: string }>();
  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPrompt = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!promptId) {
        setError('Prompt not found');
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }
      setError((current) => (silent ? current : null));
      try {
        const response = await fetch(`${API_BASE_URL}/prompts/${promptId}`, {
          credentials: 'include'
        });

        if (response.status === 404) {
          setPrompt(null);
          setError('Prompt not found');
          return;
        }

        if (!response.ok) {
          let message = 'Unable to load prompt';
          try {
            const payload = await response.json();
            message = payload.message ?? message;
          } catch {
            // ignore parse errors
          }
          throw new Error(message);
        }

        const payload = (await response.json()) as { prompt: PromptDetail };
        setPrompt(payload.prompt);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load prompt';
        setError(message);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [promptId]
  );

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    if (!promptId) {
      return;
    }

    const interval = window.setInterval(() => {
      loadPrompt({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [promptId, loadPrompt]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadPrompt({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadPrompt]);

  return (
    <>
      <AppHeader user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <Container maxW="5xl" py={12}>
        <Stack spacing={6}>
          <HStack justify="space-between" align="center">
            <Button variant="link" as={RouterLink} to="/" colorScheme="purple">
              Back to history
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefresh} isLoading={isRefreshing}>
              Refresh status
            </Button>
          </HStack>
          {isLoading ? (
            <Center py={12}>
              <Spinner />
            </Center>
          ) : error ? (
            <Alert status="error">
              <AlertIcon />
              {error}
            </Alert>
          ) : prompt ? (
            <Stack spacing={6}>
              <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
                <Stack spacing={4}>
                  <HStack justify="space-between" align="flex-start">
                    <Heading size="lg">{prompt.title}</Heading>
                    <PromptStatusBadge status={prompt.status} />
                  </HStack>
                  <Text fontSize="sm" color="gray.500">
                    Prompt ID: <Code>{prompt.id}</Code>
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Created {new Date(prompt.createdAt).toLocaleString()} · Updated{' '}
                    {new Date(prompt.updatedAt).toLocaleString()}
                  </Text>
                  <Divider />
                  <Stack spacing={2}>
                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                      Prompt
                    </Text>
                    <Text color="gray.700">{prompt.promptText}</Text>
                  </Stack>
                  <Divider />
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                      Preview slug
                    </Text>
                    <Code>{prompt.previewSlug ?? 'pending-assignment'}</Code>
                  </Stack>
                  {prompt.renderError ? (
                    <Alert status="error" variant="left-accent">
                      <AlertIcon />
                      {prompt.renderError}
                    </Alert>
                  ) : null}
                </Stack>
              </Box>

              <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
                <Stack spacing={3}>
                  <Heading size="sm">Latest Codex events</Heading>
                  <PromptEventList events={prompt.events} emptyLabel="No Codex activity recorded yet." />
                </Stack>
              </Box>

              <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
                <PromptPreviewPanel prompt={prompt} />
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </>
  );
}

function PromptPreviewPanel({ prompt }: { prompt: PromptDetail }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const canLaunchPreview = prompt.status === 'ready' && !!prompt.jsxSource;
  const helperText = canLaunchPreview
    ? `Preview slug: ${prompt.previewSlug ?? 'not-set'}`
    : 'Preview becomes available when Codex finishes building.';

  return (
    <>
      <Stack spacing={3}>
        <Heading size="sm">Preview & launch</Heading>
        <Text fontSize="sm" color="gray.600">
          Render Codex output in a modal sandbox without leaving the dashboard.
        </Text>
        <HStack spacing={4}>
          <Button colorScheme="purple" onClick={() => setIsModalOpen(true)} isDisabled={!canLaunchPreview}>
            Launch preview
          </Button>
          <Text fontSize="sm" color={canLaunchPreview ? 'gray.600' : 'gray.400'}>
            {helperText}
          </Text>
        </HStack>
      </Stack>
      <PromptPreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        jsxSource={prompt.jsxSource}
        title={prompt.title}
      />
    </>
  );
}

function PromptPreviewModal({
  isOpen,
  onClose,
  jsxSource,
  title
}: {
  isOpen: boolean;
  onClose: () => void;
  jsxSource: string | null;
  title: string;
}) {
  return (
    <Modal size="6xl" isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title} preview</ModalHeader>
        <ModalCloseButton />
        <ModalBody minH="360px">
          {jsxSource ? (
            <DynamicComponent code={jsxSource} />
          ) : (
            <Alert status="warning">
              <AlertIcon />
              JSX source is missing for this prompt.
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function DynamicComponent({ code }: { code: string }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const moduleShim = { exports: {} as Record<string, unknown> };
      const requireShim = (name: string) => {
        if (name === 'react') {
          return React;
        }
        throw new Error(`Unsupported import: ${name}`);
      };

      const strippedImports = code.replace(/^import[^;]+;?/gm, '').trim();
      const transformed = Babel.transform(strippedImports, {
        presets: ['react'],
        plugins: ['transform-modules-commonjs'],
        filename: 'dynamic.jsx'
      }).code;

      const componentFactory = new Function(
        'React',
        'useState',
        'useEffect',
        'require',
        'module',
        'exports',
        `${transformed}; const candidate = typeof App !== 'undefined' ? App : (module?.exports?.default ?? module?.exports?.App ?? null); return candidate;`
      );

      const GeneratedComponent = componentFactory(
        React,
        useState,
        useEffect,
        requireShim,
        moduleShim,
        moduleShim.exports
      );
      if (!cancelled) {
        setComponent(() => (GeneratedComponent as ComponentType | null) ?? (() => null));
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to render preview';
      if (!cancelled) {
        setError(message);
        setComponent(null);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  if (!Component) {
    return (
      <Center py={8}>
        <Spinner />
      </Center>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} bg="white">
      <Component />
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
            <Route path="/prompts/:promptId" element={<PromptDetailPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
