/// SurakshaFlow — User Dashboard
/// End-user risk view with live simulation, SMS/email analysis, warnings.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';

import '../models/types.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart' as app;
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import '../widgets/risk_gauge.dart';
import '../widgets/risk_badge.dart';
import '../widgets/section_header.dart';

class UserDashboard extends StatefulWidget {
  const UserDashboard({super.key});

  @override
  State<UserDashboard> createState() => _UserDashboardState();
}

class _UserDashboardState extends State<UserDashboard> {
  Timer? _timer;
  bool _running = true;
  int _totalTicks = 0;
  UserLiveEvent? _currentEvent;
  List<RiskTrendPoint> _riskTrend = [];
  String? _error;

  // SMS/Email analysis
  final _smsCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  SMSAnalysisResult? _smsResult;
  EmailAnalysisResult? _emailResult;
  bool _smsLoading = false;
  bool _emailLoading = false;
  int _activeTab = 0; // 0=Overview, 1=SMS, 2=Email

  String get _accountId {
    final auth = context.read<app.AuthProvider>();
    final profile = auth.profile;
    if (profile == null) return 'acc_priya';
    if (profile.linkedAccounts.isNotEmpty) return profile.linkedAccounts[0];
    return 'acc_${profile.uid.length > 8 ? profile.uid.substring(0, 8) : profile.uid}';
  }

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _smsCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  void _startPolling() {
    // Immediate first fetch
    _fetchEvent();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_running) _fetchEvent();
    });
  }

  Future<void> _fetchEvent() async {
    UserLiveEvent event;
    try {
      event = await ApiService.fetchUserLiveEvent(_accountId);
    } catch (_) {
      // API unreachable — use locally generated demo data
      event = ApiService.generateDemoUserLiveEvent(_accountId);
    }
    if (!mounted) return;
    setState(() {
      _currentEvent = event;
      _totalTicks++;
      _riskTrend = event.riskTrend;
      _error = null;
    });
  }

  Future<void> _analyzeSMS() async {
    if (_smsCtrl.text.trim().isEmpty) return;
    setState(() => _smsLoading = true);
    try {
      final res = await ApiService.analyzeSMS(_smsCtrl.text.trim());
      if (mounted) setState(() => _smsResult = res);
    } catch (_) {}
    if (mounted) setState(() => _smsLoading = false);
  }

  Future<void> _analyzeEmail() async {
    if (_emailCtrl.text.trim().isEmpty) return;
    setState(() => _emailLoading = true);
    try {
      final res =
          await ApiService.analyzeEmail(_emailCtrl.text.trim());
      if (mounted) setState(() => _emailResult = res);
    } catch (_) {}
    if (mounted) setState(() => _emailLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final scores = _currentEvent?.riskScores;
    final unified = scores?.unifiedScore ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Security Dashboard'),
        actions: [
          IconButton(
            icon: Icon(
              _running ? Icons.pause : Icons.play_arrow,
              color: _running ? AppTheme.amber : AppTheme.emerald,
              size: 20,
            ),
            onPressed: () => setState(() => _running = !_running),
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: () {
              context.read<app.AuthProvider>().signOut();
              Navigator.of(context).pushReplacementNamed('/auth');
            },
          ),
        ],
      ),
      body: _currentEvent == null && _totalTicks == 0
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppTheme.emerald),
                  SizedBox(height: 16),
                  Text('Loading your security profile…',
                      style: TextStyle(color: AppTheme.emerald)),
                ],
              ),
            )
          : Column(
              children: [
                // Tab bar
                Container(
                  color: AppTheme.surface,
                  child: Row(
                    children: [
                      _tab('Overview', 0),
                      _tab('SMS Check', 1),
                      _tab('Email Check', 2),
                    ],
                  ),
                ),
                Expanded(
                  child: IndexedStack(
                    index: _activeTab,
                    children: [
                      _overviewTab(unified, scores),
                      _smsTab(),
                      _emailTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _tab(String label, int idx) {
    final active = _activeTab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: active ? AppTheme.amber : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: active ? AppTheme.amber : Colors.grey[500],
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  // ══════════ OVERVIEW TAB ══════════
  Widget _overviewTab(double unified, RiskScores? scores) {
    final gemini = _currentEvent?.geminiAnalysis;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Risk Gauge
        Center(child: RiskGauge(score: unified, size: 130, label: 'Your Risk')),
        const SizedBox(height: 8),
        Center(
          child: RiskBadge(score: unified),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            'Account: $_accountId  ·  Tick #$_totalTicks',
            style: TextStyle(color: Colors.grey[500], fontSize: 11),
          ),
        ),
        const SizedBox(height: 20),

        // Score breakdown
        if (scores != null)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _miniGauge('Cyber', scores.cyberScore, AppTheme.cyan),
              _miniGauge('Financial', scores.financialScore, AppTheme.amber),
              _miniGauge('Graph', scores.graphScore, AppTheme.purple),
            ],
          ),
        const SizedBox(height: 20),

        // Warnings
        if (_currentEvent != null && _currentEvent!.warnings.isNotEmpty) ...[
          const SectionHeader(
            icon: Icons.warning_amber,
            iconColor: AppTheme.amber,
            title: 'Active Warnings',
          ),
          const SizedBox(height: 8),
          ...(_currentEvent!.warnings.map((w) => _warningCard(w))),
          const SizedBox(height: 16),
        ],

        // Gemini analysis
        if (gemini != null) ...[
          GlassCard(
            borderColor: AppTheme.purple.withValues(alpha: 0.25),
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.psychology,
                        size: 16, color: AppTheme.purple),
                    const SizedBox(width: 6),
                    const Text(
                      'AI Security Analysis',
                      style: TextStyle(
                        color: AppTheme.purple,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _urgencyColor(gemini.urgency)
                            .withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        gemini.urgency.toUpperCase(),
                        style: TextStyle(
                          color: _urgencyColor(gemini.urgency),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  gemini.explanation,
                  style: TextStyle(
                      color: Colors.grey[300], fontSize: 12, height: 1.4),
                ),
                if (gemini.stepsToTake.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('Steps to Take:',
                      style: TextStyle(
                          color: AppTheme.amber,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                  ...gemini.stepsToTake.map((s) => Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• ',
                                style: TextStyle(
                                    color: AppTheme.amber, fontSize: 11)),
                            Expanded(
                              child: Text(s,
                                  style: TextStyle(
                                      color: Colors.grey[300],
                                      fontSize: 11)),
                            ),
                          ],
                        ),
                      )),
                ],
                if (gemini.shouldContactBank)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.phone, size: 14, color: AppTheme.red),
                          SizedBox(width: 6),
                          Text(
                            'Contact your bank immediately',
                            style:
                                TextStyle(color: AppTheme.red, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Risk Trend
        if (_riskTrend.isNotEmpty) ...[
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionHeader(
                  icon: Icons.trending_up,
                  iconColor: AppTheme.cyan,
                  title: 'Risk Trend',
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 160,
                  child: LineChart(
                    LineChartData(
                      minY: 0,
                      maxY: 1,
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        getDrawingHorizontalLine: (_) => FlLine(
                          color: Colors.white.withValues(alpha: 0.05),
                          strokeWidth: 1,
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      titlesData: FlTitlesData(
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 30,
                            getTitlesWidget: (v, _) => Text(
                              '${(v * 100).toInt()}%',
                              style: TextStyle(
                                  color: Colors.grey[600], fontSize: 9),
                            ),
                          ),
                        ),
                        bottomTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: List.generate(
                            _riskTrend.length,
                            (i) => FlSpot(
                                i.toDouble(), _riskTrend[i].risk),
                          ),
                          isCurved: true,
                          color: AppTheme.emerald,
                          barWidth: 2,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: AppTheme.emerald.withValues(alpha: 0.1),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],

        // Error
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'Error: $_error',
              style: const TextStyle(color: AppTheme.red, fontSize: 11),
            ),
          ),
      ],
    );
  }

  Widget _miniGauge(String label, double score, Color color) {
    return Column(
      children: [
        RiskGauge(score: score, size: 60),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: Colors.grey[500], fontSize: 10)),
      ],
    );
  }

  Widget _warningCard(UserWarning w) {
    final color = _severityColor(w.severity);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber, size: 14, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  w.title,
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  w.severity.toUpperCase(),
                  style: TextStyle(
                      color: color, fontSize: 8, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(w.detail,
              style: TextStyle(color: Colors.grey[400], fontSize: 11)),
          const SizedBox(height: 4),
          Text('Action: ${w.action}',
              style: const TextStyle(color: AppTheme.amber, fontSize: 10)),
        ],
      ),
    );
  }

  // ══════════ SMS TAB ══════════
  Widget _smsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SectionHeader(
          icon: Icons.sms,
          iconColor: AppTheme.cyan,
          title: 'SMS Scam Detector',
        ),
        const SizedBox(height: 8),
        Text(
          'Paste a suspicious SMS message to check if it\'s a scam.',
          style: TextStyle(color: Colors.grey[500], fontSize: 12),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _smsCtrl,
          maxLines: 5,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: const InputDecoration(
            hintText:
                'Paste SMS here… e.g. "Dear customer, your KYC is expired…"',
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _smsLoading ? null : _analyzeSMS,
            icon: _smsLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppTheme.bg),
                  )
                : const Icon(Icons.psychology, size: 16),
            label: Text(_smsLoading ? 'Analyzing…' : 'Analyze with Gemini AI'),
          ),
        ),
        const SizedBox(height: 16),
        if (_smsResult != null) _smsResultCard(),
      ],
    );
  }

  Widget _smsResultCard() {
    final r = _smsResult!;
    final isScam = r.isScam;
    final color = isScam ? AppTheme.red : AppTheme.emerald;
    return GlassCard(
      borderColor: color.withValues(alpha: 0.3),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isScam ? Icons.dangerous : Icons.check_circle,
                color: color,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                isScam ? 'SCAM DETECTED' : 'LIKELY SAFE',
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              Text(
                '${(r.confidence * 100).toInt()}%',
                style: TextStyle(
                    color: color, fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(r.explanation,
              style: TextStyle(color: Colors.grey[300], fontSize: 12)),
          if (r.riskIndicators.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: r.riskIndicators.map((i) {
                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(i,
                      style: TextStyle(color: color, fontSize: 10)),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ══════════ EMAIL TAB ══════════
  Widget _emailTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SectionHeader(
          icon: Icons.email,
          iconColor: AppTheme.purple,
          title: 'Email Phishing Detector',
        ),
        const SizedBox(height: 8),
        Text(
          'Paste suspicious email content to detect phishing attempts.',
          style: TextStyle(color: Colors.grey[500], fontSize: 12),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _emailCtrl,
          maxLines: 8,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: const InputDecoration(
            hintText: 'Paste email content here…',
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _emailLoading ? null : _analyzeEmail,
            icon: _emailLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppTheme.bg),
                  )
                : const Icon(Icons.psychology, size: 16),
            label:
                Text(_emailLoading ? 'Analyzing…' : 'Analyze with Gemini AI'),
          ),
        ),
        const SizedBox(height: 16),
        if (_emailResult != null) _emailResultCard(),
      ],
    );
  }

  Widget _emailResultCard() {
    final r = _emailResult!;
    final isPhishing = r.isPhishing;
    final color = isPhishing ? AppTheme.red : AppTheme.emerald;
    return GlassCard(
      borderColor: color.withValues(alpha: 0.3),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isPhishing ? Icons.dangerous : Icons.check_circle,
                color: color,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                isPhishing ? 'PHISHING DETECTED' : 'LIKELY SAFE',
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(r.explanation,
              style: TextStyle(color: Colors.grey[300], fontSize: 12)),
          const SizedBox(height: 6),
          Text(
            'Threat Type: ${r.threatType}',
            style: TextStyle(color: Colors.grey[400], fontSize: 11),
          ),
          Text(
            'Action: ${r.recommendedAction}',
            style: const TextStyle(color: AppTheme.amber, fontSize: 11),
          ),
          if (r.riskIndicators.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: r.riskIndicators.map((i) {
                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(i,
                      style: TextStyle(color: color, fontSize: 10)),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Color _severityColor(String s) {
    switch (s) {
      case 'critical':
        return AppTheme.red;
      case 'high':
        return Colors.orange;
      case 'warning':
        return AppTheme.amber;
      default:
        return AppTheme.cyan;
    }
  }

  Color _urgencyColor(String u) {
    switch (u) {
      case 'dangerous':
        return AppTheme.red;
      case 'caution':
        return AppTheme.amber;
      default:
        return AppTheme.emerald;
    }
  }
}
