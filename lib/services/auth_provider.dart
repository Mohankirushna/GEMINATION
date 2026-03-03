/// SurakshaFlow — Auth Provider (Firebase + Demo fallback)
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/types.dart';
import 'api_service.dart';

class AuthProvider extends ChangeNotifier {
  fb.User? _fbUser;
  UserProfile? _profile;
  bool _loading = true;
  String? _error;
  bool _isConfigured = false;

  fb.User? get firebaseUser => _fbUser;
  UserProfile? get profile => _profile;
  bool get loading => _loading;
  String? get error => _error;
  bool get isLoggedIn => _profile != null;
  bool get isConfigured => _isConfigured;

  AuthProvider() {
    _init();
  }

  void _init() {
    try {
      fb.FirebaseAuth.instance; // throws if not initialized
      _isConfigured = true;
      fb.FirebaseAuth.instance.authStateChanges().listen((user) async {
        _fbUser = user;
        if (user != null) {
          _profile = await _fetchProfile(user);
        } else {
          _profile = null;
        }
        _loading = false;
        notifyListeners();
      });
    } catch (_) {
      _isConfigured = false;
      _loading = false;
      notifyListeners();
    }
  }

  Future<UserProfile?> _fetchProfile(fb.User user) async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      if (doc.exists) {
        final d = doc.data()!;
        return UserProfile(
          uid: user.uid,
          email: user.email ?? '',
          displayName: d['display_name'] ?? user.displayName ?? '',
          role: UserRoleExtension.fromString(d['role'] ?? 'end_user'),
          linkedAccounts:
              (d['linked_accounts'] as List?)?.cast<String>() ?? [],
          photoURL: user.photoURL,
        );
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // Email/Password Sign In
  Future<void> signIn(String email, String password) async {
    if (!_isConfigured) {
      // Demo mode fallback
      final role = (email.contains('bank') ||
              email.contains('sbi') ||
              email.contains('institution'))
          ? UserRole.financialInstitution
          : UserRole.endUser;
      _profile = _makeDemoProfile(role);
      _profile = UserProfile(
        uid: 'demo_${DateTime.now().millisecondsSinceEpoch}',
        email: email,
        displayName: email.split('@')[0],
        role: role,
        linkedAccounts:
            role == UserRole.endUser ? ['acc_demo'] : [],
      );
      try {
        final accountId = 'acc_${_profile!.uid.substring(0, 8)}';
        await ApiService.generateUserData(accountId, email: email);
      } catch (_) {}
      _loading = false;
      _error = null;
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await fb.FirebaseAuth.instance
          .signInWithEmailAndPassword(email: email, password: password);
    } on fb.FirebaseAuthException catch (e) {
      _loading = false;
      _error = _mapAuthError(e.code);
      notifyListeners();
      rethrow;
    }
  }

  // Email/Password Sign Up
  Future<void> signUp(
      String email, String password, String displayName, UserRole role) async {
    if (!_isConfigured) {
      _profile = UserProfile(
        uid: 'demo_${DateTime.now().millisecondsSinceEpoch}',
        email: email,
        displayName: displayName,
        role: role,
        linkedAccounts: [],
      );
      try {
        final accountId = 'acc_${_profile!.uid.substring(0, 8)}';
        await ApiService.generateUserData(accountId, email: email);
      } catch (_) {}
      _loading = false;
      _error = null;
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final cred = await fb.FirebaseAuth.instance
          .createUserWithEmailAndPassword(email: email, password: password);
      await cred.user?.updateDisplayName(displayName);
      await FirebaseFirestore.instance
          .collection('users')
          .doc(cred.user!.uid)
          .set({
        'email': email,
        'display_name': displayName,
        'role': role.value,
        'linked_accounts': [],
        'created_at': DateTime.now().toIso8601String(),
      });
      try {
        final accountId = 'acc_${cred.user!.uid.substring(0, 8)}';
        await ApiService.generateUserData(accountId, email: email);
      } catch (_) {}

      _profile = UserProfile(
        uid: cred.user!.uid,
        email: email,
        displayName: displayName,
        role: role,
        linkedAccounts: [],
        photoURL: cred.user?.photoURL,
      );
      _loading = false;
      _error = null;
      notifyListeners();
    } on fb.FirebaseAuthException catch (e) {
      _loading = false;
      _error = _mapAuthError(e.code);
      notifyListeners();
      rethrow;
    }
  }

  // Google Sign-In
  Future<void> signInWithGoogle({UserRole? role}) async {
    if (!_isConfigured) {
      final demoRole = role ?? UserRole.endUser;
      _profile = _makeDemoProfile(demoRole);
      _loading = false;
      _error = null;
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final googleProvider = fb.GoogleAuthProvider();
      final cred =
          await fb.FirebaseAuth.instance.signInWithProvider(googleProvider);

      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(cred.user!.uid)
          .get();
      if (!doc.exists) {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(cred.user!.uid)
            .set({
          'email': cred.user!.email,
          'display_name': cred.user!.displayName,
          'role': (role ?? UserRole.endUser).value,
          'linked_accounts': [],
          'created_at': DateTime.now().toIso8601String(),
        });
        try {
          final accountId = 'acc_${cred.user!.uid.substring(0, 8)}';
          await ApiService.generateUserData(accountId,
              email: cred.user!.email ?? '');
        } catch (_) {}
      }
    } on fb.FirebaseAuthException catch (e) {
      _loading = false;
      _error = _mapAuthError(e.code);
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signOut() async {
    if (_isConfigured) {
      await fb.FirebaseAuth.instance.signOut();
    }
    _profile = null;
    _fbUser = null;
    _error = null;
    notifyListeners();
  }

  void setDemoRole(UserRole role) {
    _profile = _makeDemoProfile(role);
    _loading = false;
    notifyListeners();
  }

  UserProfile _makeDemoProfile(UserRole role) {
    return UserProfile(
      uid: 'demo',
      email: role == UserRole.financialInstitution
          ? 'analyst@sbi.co.in'
          : 'priya@example.com',
      displayName: role == UserRole.financialInstitution
          ? 'Ravi Sharma (SBI Analyst)'
          : 'Priya Mehta',
      role: role,
      linkedAccounts:
          role == UserRole.financialInstitution ? [] : ['acc_priya'],
    );
  }

  String _mapAuthError(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'This email is already registered. Try logging in.';
      case 'invalid-credential':
        return 'Invalid email or password.';
      case 'weak-password':
        return 'Password must be at least 6 characters.';
      case 'invalid-email':
        return 'Please enter a valid email address.';
      case 'user-not-found':
        return 'No account found with this email.';
      case 'too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Authentication failed: $code';
    }
  }
}
