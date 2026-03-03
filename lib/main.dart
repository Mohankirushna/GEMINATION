/// SurakshaFlow — Cross-Platform Mobile App
/// Main entry point with Firebase init, Auth, and routing.

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';

import 'theme/app_theme.dart';
import 'services/auth_provider.dart' as app;
import 'pages/auth_page.dart';
import 'pages/bank_dashboard.dart';
import 'pages/user_dashboard.dart';
import 'pages/network_graph_page.dart';
import 'pages/settings_page.dart';
import 'models/types.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const SurakshaFlowApp());
}

class SurakshaFlowApp extends StatelessWidget {
  const SurakshaFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => app.AuthProvider(),
      child: MaterialApp(
        title: 'SurakshaFlow',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        initialRoute: '/auth',
        routes: {
          '/auth': (_) => const AuthPage(),
          '/bank': (_) => const _BankShell(),
          '/user': (_) => const _UserShell(),
          '/settings': (_) => const SettingsPage(),
        },
      ),
    );
  }
}

/// Bank role shell with bottom nav (Dashboard, Graph, Settings)
class _BankShell extends StatefulWidget {
  const _BankShell();

  @override
  State<_BankShell> createState() => _BankShellState();
}

class _BankShellState extends State<_BankShell> {
  int _idx = 0;

  @override
  void initState() {
    super.initState();
    _guardRole();
  }

  void _guardRole() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<app.AuthProvider>();

      if (auth.profile == null) {
        Navigator.of(context).pushReplacementNamed('/auth');
      } else if (auth.profile!.role != UserRole.financialInstitution) {
        Navigator.of(context).pushReplacementNamed('/user');
      }
    });
  }

  static const _pages = <Widget>[
    BankDashboard(),
    NetworkGraphPage(),
    SettingsPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _idx, children: _pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _idx,
        onTap: (i) => setState(() => _idx = i),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.hub),
            label: 'Graph',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

/// User role shell with bottom nav (Dashboard, Settings)
class _UserShell extends StatefulWidget {
  const _UserShell();

  @override
  State<_UserShell> createState() => _UserShellState();
}

class _UserShellState extends State<_UserShell> {
  int _idx = 0;

  @override
  void initState() {
    super.initState();
    _guardRole();
  }

  void _guardRole() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<app.AuthProvider>();

      if (auth.profile == null) {
        Navigator.of(context).pushReplacementNamed('/auth');
      } else if (auth.profile!.role != UserRole.endUser) {
        Navigator.of(context).pushReplacementNamed('/bank');
      }
    });
  }

  static const _pages = <Widget>[
    UserDashboard(),
    SettingsPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _idx, children: _pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _idx,
        onTap: (i) => setState(() => _idx = i),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.security),
            label: 'Security',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}