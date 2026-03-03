/// RiskGauge — Circular gauge widget for risk score
import 'dart:math';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class RiskGauge extends StatelessWidget {
  final double score;
  final double size;
  final String? label;

  const RiskGauge({
    super.key,
    required this.score,
    this.size = 100,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final color = AppTheme.riskColor(score);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _GaugePainter(score: score, color: color),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${(score * 100).toInt()}%',
                style: TextStyle(
                  color: color,
                  fontSize: size * 0.22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (label != null)
                Text(
                  label!,
                  style: TextStyle(
                    color: AppTheme.textTertiary,
                    fontSize: size * 0.1,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double score;
  final Color color;

  _GaugePainter({required this.score, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 6;
    const startAngle = -pi * 0.75;
    const totalAngle = pi * 1.5;

    // Background arc
    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      totalAngle,
      false,
      bgPaint,
    );

    // Score arc
    final scorePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      totalAngle * score.clamp(0, 1),
      false,
      scorePaint,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) =>
      old.score != score || old.color != color;
}
