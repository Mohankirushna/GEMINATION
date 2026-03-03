/// SurakshaFlow — Network Graph Page
/// Force-directed graph visualization of accounts and devices.
import 'dart:math';
import 'package:flutter/material.dart';
import '../models/types.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class NetworkGraphPage extends StatefulWidget {
  const NetworkGraphPage({super.key});

  @override
  State<NetworkGraphPage> createState() => _NetworkGraphPageState();
}

class _NetworkGraphPageState extends State<NetworkGraphPage>
    with SingleTickerProviderStateMixin {
  GraphData? _graphData;
  bool _loading = true;
  String? _error;
  late AnimationController _animCtrl;

  // Layout positions
  Map<String, Offset> _positions = {};
  String? _selectedNode;
  Offset _pan = Offset.zero;
  double _scale = 1.0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    _loadGraph();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadGraph() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.fetchGraphData();
      if (mounted) {
        setState(() {
          _graphData = data;
          _error = null;
          _loading = false;
          _layoutGraph();
        });
      }
    } catch (_) {
      // API unreachable — use demo graph data
      if (mounted) {
        setState(() {
          _graphData = ApiService.generateDemoGraphData();
          _error = null;
          _loading = false;
          _layoutGraph();
        });
      }
    }
  }

  void _layoutGraph() {
    if (_graphData == null) return;
    final rng = Random(42);
    final nodes = _graphData!.nodes;
    // Simple circular layout
    for (int i = 0; i < nodes.length; i++) {
      final angle = 2 * pi * i / nodes.length;
      final radius = 120.0 + rng.nextDouble() * 60;
      _positions[nodes[i].id] = Offset(
        200 + radius * cos(angle),
        300 + radius * sin(angle),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Network Intelligence'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: _loadGraph,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppTheme.cyan),
                  SizedBox(height: 12),
                  Text('Loading network graph…',
                      style: TextStyle(color: AppTheme.cyan, fontSize: 13)),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error, color: AppTheme.red, size: 40),
                      const SizedBox(height: 8),
                      Text('Error: $_error',
                          style: const TextStyle(
                              color: AppTheme.red, fontSize: 12)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                          onPressed: _loadGraph,
                          child: const Text('Retry')),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    // Graph canvas
                    GestureDetector(
                      onScaleUpdate: (d) {
                        setState(() {
                          _scale = (_scale * d.scale).clamp(0.3, 3.0);
                          _pan += d.focalPointDelta;
                        });
                      },
                      child: AnimatedBuilder(
                        animation: _animCtrl,
                        builder: (context, _) {
                          return CustomPaint(
                            size: Size.infinite,
                            painter: _GraphPainter(
                              graphData: _graphData!,
                              positions: _positions,
                              pan: _pan,
                              scale: _scale,
                              selectedNode: _selectedNode,
                            ),
                          );
                        },
                      ),
                    ),

                    // Node tap detection (overlay transparent buttons)
                    ..._buildNodeTapAreas(),

                    // Legend
                    Positioned(
                      top: 16,
                      left: 16,
                      child: GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _legendItem(AppTheme.cyan, 'Account'),
                            const SizedBox(height: 4),
                            _legendItem(AppTheme.purple, 'Device'),
                            const SizedBox(height: 6),
                            Text(
                              '${_graphData?.nodes.length ?? 0} nodes · ${_graphData?.edges.length ?? 0} edges',
                              style: TextStyle(
                                  color: Colors.grey[500], fontSize: 9),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Selected node info
                    if (_selectedNode != null) _buildNodeInfo(),
                  ],
                ),
    );
  }

  List<Widget> _buildNodeTapAreas() {
    if (_graphData == null) return [];
    return _graphData!.nodes.map((node) {
      final pos = _positions[node.id];
      if (pos == null) return const SizedBox.shrink();
      final transformed = Offset(
        pos.dx * _scale + _pan.dx,
        pos.dy * _scale + _pan.dy,
      );
      return Positioned(
        left: transformed.dx - 15,
        top: transformed.dy - 15,
        child: GestureDetector(
          onTap: () => setState(() =>
              _selectedNode = _selectedNode == node.id ? null : node.id),
          child: Container(
            width: 30,
            height: 30,
            color: Colors.transparent,
          ),
        ),
      );
    }).toList();
  }

  Widget _buildNodeInfo() {
    final node =
        _graphData!.nodes.firstWhere((n) => n.id == _selectedNode);
    return Positioned(
      bottom: 16,
      left: 16,
      right: 16,
      child: GlassCard(
        borderColor: AppTheme.riskColor(node.riskScore).withValues(alpha: 0.3),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(
                  node.type == 'account' ? Icons.account_circle : Icons.devices,
                  color: node.type == 'account'
                      ? AppTheme.cyan
                      : AppTheme.purple,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    node.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() => _selectedNode = null),
                  child: const Icon(Icons.close, size: 18, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text('Type: ${node.type}',
                    style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                const SizedBox(width: 16),
                Text(
                  'Risk: ${(node.riskScore * 100).toInt()}%',
                  style: TextStyle(
                    color: AppTheme.riskColor(node.riskScore),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (node.community != null) ...[
                  const SizedBox(width: 16),
                  Text('Community: ${node.community}',
                      style: TextStyle(
                          color: Colors.grey[400], fontSize: 11)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: Colors.grey[400], fontSize: 10)),
      ],
    );
  }
}

class _GraphPainter extends CustomPainter {
  final GraphData graphData;
  final Map<String, Offset> positions;
  final Offset pan;
  final double scale;
  final String? selectedNode;

  _GraphPainter({
    required this.graphData,
    required this.positions,
    required this.pan,
    required this.scale,
    this.selectedNode,
  });

  Offset _transform(Offset pos) =>
      Offset(pos.dx * scale + pan.dx, pos.dy * scale + pan.dy);

  @override
  void paint(Canvas canvas, Size size) {
    // Draw edges
    final edgePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.1)
      ..strokeWidth = 1;

    for (final edge in graphData.edges) {
      final from = positions[edge.source];
      final to = positions[edge.target];
      if (from == null || to == null) continue;
      canvas.drawLine(_transform(from), _transform(to), edgePaint);
    }

    // Draw nodes
    for (final node in graphData.nodes) {
      final pos = positions[node.id];
      if (pos == null) continue;
      final tp = _transform(pos);

      final isAccount = node.type == 'account';
      final baseColor = isAccount ? AppTheme.cyan : AppTheme.purple;
      final riskClr = AppTheme.riskColor(node.riskScore);
      final isSelected = node.id == selectedNode;

      // Glow for high risk
      if (node.riskScore >= 0.7) {
        final glowPaint = Paint()
          ..color = riskClr.withValues(alpha: 0.2)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
        canvas.drawCircle(tp, 12 * scale, glowPaint);
      }

      // Node circle
      final nodePaint = Paint()
        ..color = isSelected ? Colors.white : baseColor
        ..style = isSelected ? PaintingStyle.fill : PaintingStyle.fill;
      canvas.drawCircle(tp, (isSelected ? 8 : 6) * scale, nodePaint);

      // Risk ring
      final ringPaint = Paint()
        ..color = riskClr
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * scale;
      canvas.drawCircle(tp, 8 * scale, ringPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _GraphPainter old) => true;
}
