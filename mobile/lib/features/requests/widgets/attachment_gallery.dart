import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/config/env.dart';
import '../../../theme/app_colors.dart';

/// Horizontal thumbnail strip for a request's `images[]`, with a full-screen
/// zoomable viewer on tap. Shows nothing if there are no images.
class RequestImageGallery extends StatelessWidget {
  const RequestImageGallery({super.key, required this.images});

  final List<String> images;

  @override
  Widget build(BuildContext context) {
    if (images.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: images.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final url = Env.mediaUrl(images[i]);
          return InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _openViewer(context, images, i),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: CachedNetworkImage(
                imageUrl: url,
                width: 92,
                height: 92,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  width: 92,
                  height: 92,
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: const Icon(Icons.broken_image_outlined),
                ),
                placeholder: (context, _) => Container(
                  width: 92,
                  height: 92,
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _openViewer(BuildContext context, List<String> images, int initialIndex) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ImageViewerScreen(images: images, initialIndex: initialIndex),
        fullscreenDialog: true,
      ),
    );
  }
}

class _ImageViewerScreen extends StatefulWidget {
  const _ImageViewerScreen({required this.images, required this.initialIndex});

  final List<String> images;
  final int initialIndex;

  @override
  State<_ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<_ImageViewerScreen> {
  late final PageController _pageController = PageController(initialPage: widget.initialIndex);
  late int _current = widget.initialIndex;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_current + 1} / ${widget.images.length}'),
      ),
      body: PageView.builder(
        controller: _pageController,
        itemCount: widget.images.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (context, i) => InteractiveViewer(
          minScale: 0.8,
          maxScale: 4,
          child: Center(
            child: CachedNetworkImage(
              imageUrl: Env.mediaUrl(widget.images[i]),
              fit: BoxFit.contain,
              errorWidget: (_, __, ___) => const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
            ),
          ),
        ),
      ),
    );
  }
}

/// A compact inline play/pause/seek bar for a request's voice note
/// (`audioUrl`). Owns its own [AudioPlayer] lifecycle.
class VoiceNotePlayer extends StatefulWidget {
  const VoiceNotePlayer({super.key, required this.url});

  final String url;

  @override
  State<VoiceNotePlayer> createState() => _VoiceNotePlayerState();
}

class _VoiceNotePlayerState extends State<VoiceNotePlayer> {
  final _player = AudioPlayer();
  bool _isReady = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      await _player.setUrl(Env.mediaUrl(widget.url));
      if (mounted) setState(() => _isReady = true);
    } catch (_) {
      if (mounted) setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_hasError) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Row(
          children: [
            Icon(Icons.error_outline, size: 18, color: AppColors.destructive),
            SizedBox(width: 8),
            Text('تعذر تحميل التسجيل الصوتي', style: TextStyle(fontSize: 12.5)),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
      ),
      child: Row(
        children: [
          StreamBuilder<PlayerState>(
            stream: _player.playerStateStream,
            builder: (context, snapshot) {
              final playing = snapshot.data?.playing ?? false;
              final processingState = snapshot.data?.processingState;
              final isLoading = !_isReady || processingState == ProcessingState.loading;
              return IconButton(
                icon: isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
                      )
                    : Icon(
                        playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                        color: AppColors.gold,
                        size: 30,
                      ),
                onPressed: isLoading
                    ? null
                    : () {
                        if (playing) {
                          _player.pause();
                        } else {
                          if (processingState == ProcessingState.completed) {
                            _player.seek(Duration.zero);
                          }
                          _player.play();
                        }
                      },
              );
            },
          ),
          Expanded(
            child: StreamBuilder<Duration>(
              stream: _player.positionStream,
              builder: (context, snapshot) {
                final position = snapshot.data ?? Duration.zero;
                final duration = _player.duration ?? Duration.zero;
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3,
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                      ),
                      child: Slider(
                        value: duration.inMilliseconds == 0
                            ? 0
                            : position.inMilliseconds.clamp(0, duration.inMilliseconds).toDouble(),
                        max: duration.inMilliseconds == 0 ? 1 : duration.inMilliseconds.toDouble(),
                        activeColor: AppColors.gold,
                        onChanged: duration.inMilliseconds == 0
                            ? null
                            : (v) => _player.seek(Duration(milliseconds: v.round())),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        '${_fmt(position)} / ${_fmt(duration)}',
                        style: TextStyle(
                          fontSize: 10.5,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.mic_rounded, size: 16, color: AppColors.gold),
          const SizedBox(width: 8),
        ],
      ),
    );
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(1, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}
