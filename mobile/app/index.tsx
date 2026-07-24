import {useMemo, useState} from 'react'
import {Linking, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native'

function getConfiguredUrl() {
  const raw = (
    process.env.EXPO_PUBLIC_MOBILE_BASE_URL ||
    process.env.EXPO_PUBLIC_WEB_API_BASE_URL ||
    ''
  ).trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    const localDevelopmentHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !(__DEV__ && localDevelopmentHost)) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export default function HomeScreen() {
  const configuredUrl = useMemo(getConfiguredUrl, [])
  const [error, setError] = useState<string | null>(null)

  const openPlatform = async () => {
    if (!configuredUrl) return
    setError(null)
    try {
      await Linking.openURL(configuredUrl)
    } catch {
      setError('The configured platform URL could not be opened.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>PRYV API PLATFORM</Text>
        <Text style={styles.title}>Open the dashboard securely</Text>
        <Text style={styles.body}>
          Authentication runs in your system browser. The mobile app does not embed the dashboard,
          copy cookies, bridge OAuth tokens, or store wallet credentials.
        </Text>

        {configuredUrl ? (
          <>
            <Pressable
              accessibilityRole='button'
              onPress={() => void openPlatform()}
              style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Open dashboard</Text>
            </Pressable>
            <Text style={styles.caption}>{configuredUrl}</Text>
          </>
        ) : (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Configuration required</Text>
            <Text style={styles.noticeText}>
              Set EXPO_PUBLIC_MOBILE_BASE_URL to an HTTPS dashboard URL. Local development may use
              localhost or 127.0.0.1.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
    padding: 28,
  },
  eyebrow: {
    color: '#76cff8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
  body: {
    color: '#c4d1df',
    fontSize: 17,
    lineHeight: 26,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2da9e9',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#03111f',
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: '#8fa6bc',
    fontSize: 13,
    textAlign: 'center',
  },
  notice: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#36516a',
    borderRadius: 10,
    backgroundColor: '#0d1d2c',
    padding: 16,
  },
  noticeTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  noticeText: {
    color: '#c4d1df',
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: '#ff9d9d',
    fontSize: 14,
  },
})
