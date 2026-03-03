/// SurakshaFlow — Auth Page
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/types.dart';
import '../services/auth_provider.dart' as app;
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  bool _isLogin = true;
  bool _showPassword = false;
  bool _loading = false;
  String? _error;
  UserRole _role = UserRole.endUser;

  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final auth = context.read<app.AuthProvider>();
    try {
      if (_isLogin) {
        await auth.signIn(_emailCtrl.text.trim(), _passwordCtrl.text);
      } else {
        await auth.signUp(
          _emailCtrl.text.trim(),
          _passwordCtrl.text,
          _nameCtrl.text.trim(),
          _role,
        );
      }
      if (mounted) _navigateByRole(auth.profile!.role);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _googleLogin() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = context.read<app.AuthProvider>();
    try {
      await auth.signInWithGoogle(role: _role);
      if (auth.profile != null && mounted) {
        _navigateByRole(auth.profile!.role);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _demoLogin(UserRole role) {
    context.read<app.AuthProvider>().setDemoRole(role);
    _navigateByRole(role);
  }

  void _navigateByRole(UserRole role) {
    Navigator.of(context).pushReplacementNamed(
      role == UserRole.financialInstitution ? '/bank' : '/user',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [AppTheme.amber, AppTheme.amberDark],
                    ),
                  ),
                  child: const Icon(Icons.shield, size: 32, color: AppTheme.bg),
                ),
                const SizedBox(height: 16),
                ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(
                    colors: [AppTheme.amber, AppTheme.cyan],
                  ).createShader(bounds),
                  child: const Text(
                    'SurakshaFlow',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _isLogin
                      ? 'Sign in to your intelligence dashboard'
                      : 'Create your secure account',
                  style: TextStyle(color: Colors.grey[500], fontSize: 13),
                ),
                const SizedBox(height: 28),

                // Card
                GlassCard(
                  padding: const EdgeInsets.all(20),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        // Mode toggle
                        Row(
                          children: [
                            _modeTab('Sign In', _isLogin, () {
                              setState(() {
                                _isLogin = true;
                                _error = null;
                              });
                            }),
                            _modeTab('Sign Up', !_isLogin, () {
                              setState(() {
                                _isLogin = false;
                                _error = null;
                              });
                            }),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // Error
                        if (_error != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: AppTheme.red.withValues(alpha: 0.2)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.warning_amber,
                                    size: 16, color: AppTheme.red),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _error!,
                                    style: const TextStyle(
                                        color: AppTheme.red, fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Role selector
                        if (!_isLogin) ...[
                          Row(
                            children: [
                              _roleChip(
                                  'End User',
                                  Icons.person,
                                  UserRole.endUser),
                              const SizedBox(width: 8),
                              _roleChip(
                                  'Institution',
                                  Icons.business,
                                  UserRole.financialInstitution),
                            ],
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Name (signup)
                        if (!_isLogin) ...[
                          TextFormField(
                            controller: _nameCtrl,
                            decoration: const InputDecoration(
                              hintText: 'Full Name',
                              prefixIcon: Icon(Icons.person_outline, size: 20),
                            ),
                            style: const TextStyle(
                                color: Colors.white, fontSize: 14),
                            validator: (v) => (!_isLogin &&
                                    (v == null || v.trim().isEmpty))
                                ? 'Name required'
                                : null,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Email
                        TextFormField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            hintText: 'Email',
                            prefixIcon: Icon(Icons.mail_outline, size: 20),
                          ),
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14),
                          validator: (v) =>
                              (v == null || !v.contains('@'))
                                  ? 'Valid email required'
                                  : null,
                        ),
                        const SizedBox(height: 12),

                        // Password
                        TextFormField(
                          controller: _passwordCtrl,
                          obscureText: !_showPassword,
                          decoration: InputDecoration(
                            hintText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _showPassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                size: 20,
                              ),
                              onPressed: () => setState(
                                  () => _showPassword = !_showPassword),
                            ),
                          ),
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14),
                          validator: (v) =>
                              (v == null || v.length < 6)
                                  ? 'Min 6 characters'
                                  : null,
                        ),
                        const SizedBox(height: 20),

                        // Submit
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _submit,
                            child: _loading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppTheme.bg,
                                    ),
                                  )
                                : Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(_isLogin ? 'Sign In' : 'Create Account'),
                                      const SizedBox(width: 6),
                                      const Icon(Icons.arrow_forward, size: 16),
                                    ],
                                  ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Google
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _loading ? null : _googleLogin,
                            icon: const Icon(Icons.g_mobiledata, size: 20),
                            label: const Text('Continue with Google'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white70,
                              side: const BorderSide(color: AppTheme.border),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Demo access buttons
                Text(
                  'Quick Demo Access',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _demoButton(
                        'Bank Analyst',
                        Icons.business,
                        AppTheme.cyan,
                        () => _demoLogin(UserRole.financialInstitution),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _demoButton(
                        'End User',
                        Icons.person,
                        AppTheme.emerald,
                        () => _demoLogin(UserRole.endUser),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _modeTab(String text, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active
                ? AppTheme.amber.withValues(alpha: 0.15)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            text,
            style: TextStyle(
              color: active ? AppTheme.amber : Colors.grey[600],
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _roleChip(String text, IconData icon, UserRole r) {
    final selected = _role == r;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _role = r),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? AppTheme.amber.withValues(alpha: 0.12)
                : Colors.white.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? AppTheme.amber.withValues(alpha: 0.4)
                  : AppTheme.border,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16,
                  color: selected ? AppTheme.amber : Colors.grey[500]),
              const SizedBox(width: 6),
              Text(
                text,
                style: TextStyle(
                  fontSize: 12,
                  color: selected ? AppTheme.amber : Colors.grey[400],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _demoButton(
      String text, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        glowColor: color,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              text,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
