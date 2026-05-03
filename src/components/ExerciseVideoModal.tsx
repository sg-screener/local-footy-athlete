import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Polygon, Circle } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { colors } from '../theme/colors';
import { Text } from './common/Text';
import { Button, IconButton } from './ui';
import {
  lookupExerciseDemo,
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
} from '../services/exerciseVideoService';

interface ExerciseVideoModalProps {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
}

/**
 * Plays the pinned demo video inline inside the modal via a YouTube
 * iframe embed in a WebView.
 *
 * Fallback chain:
 *   1. Video id extractable + WebView loads        → inline playback
 *   2. WebView load fails (embed disabled, offline) → "Open in YouTube" button
 *   3. No URL pinned for this exercise             → tinted placeholder card
 *
 * Shorts are vertical (9:16) so the iframe is rendered in portrait.
 * iOS inline playback requires BOTH `playsinline=1` in the URL and
 * `allowsInlineMediaPlayback={true}` on the WebView.
 *
 * ## V2 presentation (visual-only — logic contract unchanged)
 * - Softer modal radius (xl), subtle lime border + glow.
 * - "DEMO" eyebrow + bolder title; IconButton close for hit-target parity
 *   with the rest of the app.
 * - Player frame inherits the same soft radius so the video reads as part
 *   of the card, not pasted into a plain black rectangle.
 * - External-YouTube fallback uses a V2 primary `Button` with a subtle play
 *   glyph so it feels intentional instead of emergency.
 * - No-video state shows a lime-tinted placeholder illustration with copy
 *   that reads as "coming soon" rather than "missing".
 */
export default function ExerciseVideoModal({
  visible,
  exerciseName,
  onClose,
}: ExerciseVideoModalProps) {
  const { url } = lookupExerciseDemo(exerciseName);
  const videoId = useMemo(() => extractYouTubeVideoId(url), [url]);
  const embedUrl = videoId ? buildYouTubeEmbedUrl(videoId) : null;

  // Reset load/error state whenever the modal re-opens with a new exercise.
  const [loadError, setLoadError] = useState(false);
  React.useEffect(() => {
    if (visible) setLoadError(false);
  }, [visible, videoId]);

  const handleOpenExternally = () => {
    if (!url) return;
    Linking.openURL(url);
    onClose();
  };

  // HTML wrapper. We serve our own page instead of the raw embed URL so we
  // can force a black background + 100% iframe fill and suppress the tiny
  // iOS WebView white flash on load.
  const iframeHtml = embedUrl
    ? `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
      .wrap { position: absolute; inset: 0; }
      iframe { width: 100%; height: 100%; border: 0; display: block; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <iframe
        src="${embedUrl}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        playsinline
      ></iframe>
    </div>
  </body>
</html>`
    : null;

  const showInlinePlayer = iframeHtml !== null && !loadError;
  const showExternalFallback = url !== null && (iframeHtml === null || loadError);
  const showNoVideoMessage = url === null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.eyebrow}>DEMO</Text>
              <Text style={styles.title} numberOfLines={2}>
                {exerciseName}
              </Text>
            </View>
            <IconButton
              onPress={onClose}
              accessibilityLabel="Close demo video"
              tone="default"
              size="sm"
              icon={<CloseIcon />}
            />
          </View>

          <View style={styles.body}>
            {showInlinePlayer && iframeHtml && (
              <View style={styles.playerFrame}>
                <WebView
                  source={{ html: iframeHtml, baseUrl: 'https://www.youtube-nocookie.com' }}
                  style={styles.webview}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  allowsFullscreenVideo
                  originWhitelist={['*']}
                  onError={() => setLoadError(true)}
                  onHttpError={() => setLoadError(true)}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator color={colors.accent.lime} />
                    </View>
                  )}
                />
              </View>
            )}

            {showExternalFallback && (
              <View style={styles.fallbackContainer}>
                <View style={styles.fallbackGlyph}>
                  <PlayBadge />
                </View>
                <Text style={styles.fallbackHeadline}>
                  {loadError ? "Can't play inline" : 'Watch on YouTube'}
                </Text>
                <Text style={styles.fallbackNote}>
                  {loadError
                    ? 'YouTube blocked the embed — tap below to watch it in the app.'
                    : "This demo doesn't support inline playback."}
                </Text>
                <View style={styles.fallbackButton}>
                  <Button
                    label="Open in YouTube"
                    onPress={handleOpenExternally}
                    variant="primary"
                    size="md"
                    fullWidth
                  />
                </View>
              </View>
            )}

            {showNoVideoMessage && (
              <View style={styles.noVideoContainer}>
                <View style={styles.noVideoGlyph}>
                  <FilmStripGlyph />
                </View>
                <Text style={styles.noVideoHeadline}>Demo coming soon</Text>
                <Text style={styles.noVideoText}>
                  We haven't pinned a demo for this one yet. Check back or ask
                  your coach for a form cue.
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Glyphs — small inline SVGs so the empty/error states don't
// look like missing content.
// ─────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="#CCCCCC"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PlayBadge() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Circle cx={28} cy={28} r={26} fill="rgba(200, 255, 0, 0.12)" />
      <Circle
        cx={28}
        cy={28}
        r={22}
        fill={colors.accent.lime}
        opacity={0.95}
      />
      <Polygon points="24,19 24,37 39,28" fill="#0C0C0C" />
    </Svg>
  );
}

function FilmStripGlyph() {
  // A simple film-strip look — two sprocket rails flanking a tinted frame.
  return (
    <Svg width={72} height={56} viewBox="0 0 72 56">
      <Path
        d="M4 8h64v40H4z"
        fill="rgba(200, 255, 0, 0.08)"
        stroke="rgba(200, 255, 0, 0.35)"
        strokeWidth={1.5}
      />
      {/* sprocket holes (left rail) */}
      <Circle cx={10} cy={14} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={10} cy={22} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={10} cy={30} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={10} cy={38} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      {/* sprocket holes (right rail) */}
      <Circle cx={62} cy={14} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={62} cy={22} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={62} cy={30} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      <Circle cx={62} cy={38} r={1.6} fill="rgba(200, 255, 0, 0.55)" />
      {/* play triangle */}
      <Polygon points="32,20 32,36 46,28" fill={colors.accent.lime} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  // Softer V2 radii + accent-tinted border/glow — the modal reads as part
  // of the same design language as the workout cards behind it.
  content: {
    backgroundColor: '#161616',
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    ...shadows.accentShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  eyebrow: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  body: {
    padding: 0,
  },
  // Shorts are 9:16. With modal max width 400, iframe height ≈ 711.
  // We cap via maxHeight so it fits short phones; aspectRatio handles
  // the common case. The lime border hugs the player so the live feed
  // visually anchors to the rest of the V2 accents.
  playerFrame: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 560,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.22)',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  // ── Fallback (embed blocked / error) ─────────────────────────
  fallbackContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  fallbackGlyph: {
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  fallbackNote: {
    color: '#9A9A9A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  fallbackButton: {
    alignSelf: 'stretch',
  },
  // ── No demo pinned ─────────────────────────────────────────
  noVideoContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  noVideoGlyph: {
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  noVideoText: {
    color: '#9A9A9A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
