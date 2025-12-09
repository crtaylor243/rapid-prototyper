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
  Icon,
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
import { keyframes } from '@emotion/react';
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
    <Box minH="100vh" bgGradient="linear(to-br, purple.50, blue.50)" py={24}>
      <Container maxW="sm">
        <Box borderWidth="1px" borderRadius="lg" p={8} boxShadow="lg" bg="whiteAlpha.900">
          <VStack spacing={6} align="stretch">
            <Heading size="lg" textAlign="center">
              Rapid Prototyper
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
    </Box>
  );
}

function DashboardPage() {
  const { user, getCsrfToken, refreshCsrfToken } = useAuth();
  const { handleLogout, isLoggingOut } = useLogoutAction();
  const [promptText, setPromptText] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [isSummarizingPrompt, setIsSummarizingPrompt] = useState(false);
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
    setIsSummarizingPrompt(true);
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
      setIsSummarizingPrompt(false);
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
    <Box minH="100vh" bgGradient="linear(to-br, purple.50, blue.50)">
      <AppHeader user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <Container maxW="4xl" py={12}>
        <Stack spacing={10}>
          <Box
            as="form"
            onSubmit={handlePromptSubmit}
            borderWidth="1px"
            borderRadius="lg"
            p={6}
            boxShadow="sm"
            bg="white"
          >
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
                  Codex will create your idea in real-time!
                </Text>
                <Button
                  type="submit"
                  colorScheme="purple"
                  isLoading={isSubmittingPrompt}
                  loadingText="Understanding Prototype"
                  isDisabled={!promptText.trim()}
                >
                  ⚙️ Start Building!
                </Button>
              </HStack>
            </VStack>
          </Box>

          <Stack spacing={4}>
            <HStack justify="space-between">
              <Heading size="md">Prototypes</Heading>
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
              {isSummarizingPrompt ? <PromptUnderstandingCard /> : null}
              {isLoadingPrompts ? (
                <Center py={8}>
                  <Spinner />
                </Center>
              ) : sortedPrompts.length === 0 ? (
                <Box borderWidth="1px" borderRadius="md" p={6} textAlign="center" color="gray.500" bg="white">
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
    </Box>
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
          <HStack spacing={2} align="center">
            <OpenAIIcon boxSize={7} color="black" />
            <Heading size="sm" letterSpacing="wide">
              Rapid Prototyper
            </Heading>
          </HStack>
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

  if (status === 'building') {
    return (
      <Tooltip label="Codex + Babel are building this preview" hasArrow placement="top">
        <Badge colorScheme="orange" px={2} py={1} borderRadius="md">
          <HStack spacing={1} align="center">
            <CodexGlyph animated />
            <Text fontSize="xs">{meta.label}</Text>
          </HStack>
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={meta.description} hasArrow placement="top">
      <Badge colorScheme={meta.color} px={2} py={1} borderRadius="md">
        {meta.label}
      </Badge>
    </Tooltip>
  );
}

const codexSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

function CodexGlyph({ animated = false }: { animated?: boolean }) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <Box
      as="span"
      position="relative"
      w="18px"
      h="18px"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      animation={animated ? `${codexSpin} 1.4s linear infinite` : undefined}
    >
      {petals.map((deg) => (
        <Box
          key={deg}
          position="absolute"
          w="8px"
          h="14px"
          border="2px solid"
          borderColor="purple.500"
          borderRadius="10px"
          opacity={0.8}
          transform={`rotate(${deg}deg)`}
        />
      ))}
    </Box>
  );
}

function OpenAIIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 156 154" {...props}>
      <path
        d="M59.7325 56.1915V41.6219C59.7325 40.3948 60.1929 39.4741 61.266 38.8613L90.5592 21.9915C94.5469 19.6912 99.3013 18.6181 104.208 18.6181C122.612 18.6181 134.268 32.8813 134.268 48.0637C134.268 49.1369 134.268 50.364 134.114 51.5911L103.748 33.8005C101.908 32.7274 100.067 32.7274 98.2267 33.8005L59.7325 56.1915ZM128.133 112.937V78.1222C128.133 75.9745 127.212 74.441 125.372 73.3678L86.878 50.9768L99.4538 43.7682C100.527 43.1554 101.448 43.1554 102.521 43.7682L131.814 60.6381C140.25 65.5464 145.923 75.9745 145.923 86.0961C145.923 97.7512 139.023 108.487 128.133 112.935V112.937ZM50.6841 82.2638L38.1083 74.9028C37.0351 74.29 36.5748 73.3693 36.5748 72.1422V38.4025C36.5748 21.9929 49.1506 9.5696 66.1744 9.5696C72.6162 9.5696 78.5962 11.7174 83.6585 15.5511L53.4461 33.0352C51.6062 34.1084 50.6855 35.6419 50.6855 37.7897V82.2653L50.6841 82.2638ZM77.7533 97.9066L59.7325 87.785V66.3146L77.7533 56.193L95.7725 66.3146V87.785L77.7533 97.9066ZM89.3321 144.53C82.8903 144.53 76.9103 142.382 71.848 138.549L102.06 121.064C103.9 119.991 104.821 118.458 104.821 116.31V71.8343L117.551 79.1954C118.624 79.8082 119.084 80.7289 119.084 81.956V115.696C119.084 132.105 106.354 144.529 89.3321 144.529V144.53ZM52.9843 110.33L23.6911 93.4601C15.2554 88.5517 9.58181 78.1237 9.58181 68.0021C9.58181 56.193 16.6365 45.611 27.5248 41.163V76.1299C27.5248 78.2776 28.4455 79.8111 30.2854 80.8843L68.6271 103.121L56.0513 110.33C54.9781 110.943 54.0574 110.943 52.9843 110.33ZM51.2983 135.482C33.9681 135.482 21.2384 122.445 21.2384 106.342C21.2384 105.115 21.3923 103.888 21.5448 102.661L51.7572 120.145C53.5971 121.218 55.4385 121.218 57.2784 120.145L95.7725 97.9081V112.478C95.7725 113.705 95.3122 114.625 94.239 115.238L64.9458 132.108C60.9582 134.408 56.2037 135.482 51.2969 135.482H51.2983ZM89.3321 153.731C107.889 153.731 123.378 140.542 126.907 123.058C144.083 118.61 155.126 102.507 155.126 86.0976C155.126 75.3617 150.525 64.9336 142.243 57.4186C143.01 54.1977 143.471 50.9768 143.471 47.7573C143.471 25.8267 125.68 9.41567 105.129 9.41567C100.989 9.41567 97.0011 10.0285 93.0134 11.4095C86.1112 4.66126 76.6024 0.367188 66.1744 0.367188C47.6171 0.367188 32.1282 13.5558 28.5994 31.0399C11.4232 35.4879 0.380859 51.5911 0.380859 68.0006C0.380859 78.7365 4.98133 89.1645 13.2631 96.6795C12.4963 99.9004 12.036 103.121 12.036 106.341C12.036 128.271 29.8265 144.682 50.3777 144.682C54.5178 144.682 58.5055 144.07 62.4931 142.689C69.3938 149.437 78.9026 153.731 89.3321 153.731Z"
        fill="black"
      />
    </Icon>
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

function PromptUnderstandingCard() {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm" bg="white">
      <HStack spacing={4} align="center">
        <Spinner color="purple.500" size="sm" />
        <VStack spacing={1} align="flex-start">
          <Text fontWeight="semibold">Understanding Prototype</Text>
          <Text fontSize="sm" color="gray.500">
            Codex mini is summarizing your idea into a short title.
          </Text>
        </VStack>
      </HStack>
    </Box>
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
    <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm" bg="white">
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
        {prompt.renderError ? (
          <Alert status="error" variant="left-accent">
            <AlertIcon />
            {prompt.renderError}
          </Alert>
        ) : null}
        <HStack justify="space-between" spacing={2}>
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

  return (
    <>
      <AppHeader user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <Container maxW="5xl" py={12}>
        <Stack spacing={6}>
          <HStack justify="flex-start" align="center">
            <Button variant="link" as={RouterLink} to="/" colorScheme="purple">
              ← Back
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
                <Stack spacing={5}>
                  <Stack spacing={1}>
                    <HStack justify="space-between" align="flex-start">
                      <Heading size="lg">{prompt.title}</Heading>
                      <PromptStatusBadge status={prompt.status} />
                    </HStack>
                    <Text fontSize="sm" color="gray.500">
                      Created {new Date(prompt.createdAt).toLocaleString()} · Updated{' '}
                      {new Date(prompt.updatedAt).toLocaleString()}
                    </Text>
                  </Stack>
                  <Stack spacing={2}>
                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                      Prompt
                    </Text>
                    <Text color="gray.700">{prompt.promptText}</Text>
                  </Stack>
                  {prompt.renderError ? (
                    <Alert status="error" variant="left-accent">
                      <AlertIcon />
                      {prompt.renderError}
                    </Alert>
                  ) : null}
                  <Divider />
                  <PromptPreviewPanel prompt={prompt} />
                </Stack>
              </Box>

              <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm">
                <Stack spacing={4}>
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                      Prompt ID
                    </Text>
                    <Code>{prompt.id}</Code>
                  </Stack>
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                      Preview slug
                    </Text>
                    <Code>{prompt.previewSlug ?? 'pending-assignment'}</Code>
                  </Stack>
                  <Divider />
                  <Stack spacing={3}>
                    <Heading size="sm">Codex log</Heading>
                    <PromptEventList events={prompt.events} emptyLabel="No Codex activity recorded yet." />
                  </Stack>
                </Stack>
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
    ? 'Preview is ready to launch.'
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
        <ModalHeader>Preview</ModalHeader>
        <ModalCloseButton />
        <ModalBody minH="360px">
          {jsxSource ? (
            <PreviewErrorBoundary>
              <DynamicComponent code={jsxSource} />
            </PreviewErrorBoundary>
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

class PreviewErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[preview] runtime error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Alert status="error">
          <AlertIcon />
          {this.state.error}
        </Alert>
      );
    }

    return this.props.children as JSX.Element;
  }
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
        'useMemo',
        'require',
        'module',
        'exports',
        `${transformed}; const candidate = typeof App !== 'undefined' ? App : (module?.exports?.default ?? module?.exports?.App ?? null); return candidate;`
      );

      const GeneratedComponent = componentFactory(
        React,
        useState,
        useEffect,
        useMemo,
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
