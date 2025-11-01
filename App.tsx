import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  PermissionsAndroid,
  Platform,
  NativeModules,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import CameraRoll from '@react-native-camera-roll/camera-roll';

const { CameraFpsModule, CameraHighSpeedModule } = NativeModules;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const devices = useCameraDevices();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [fpsConfigs, setFpsConfigs] = useState([]);
  const cameraRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);

  const TARGET_FPS = 120;

  /* ---------- Permissions ---------- */
  useEffect(() => {
    const requestPermissions = async () => {
      const camStatus = await Camera.requestCameraPermission();
      const micStatus = await Camera.requestMicrophonePermission();
      const grantedCamera = camStatus === 'granted';
      const grantedMic = micStatus === 'granted';

      let grantedStorage = true;
      if (Platform.OS === 'android' && Platform.Version < 33) {
        const storage = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to save photos and videos to your gallery.',
            buttonPositive: 'OK',
          },
        );
        grantedStorage = storage === PermissionsAndroid.RESULTS.GRANTED;
      }

      setHasPermission(grantedCamera && grantedMic && grantedStorage);
    };
    requestPermissions();
  }, []);

  /* ---------- Camera Selection - BACK CAMERA ONLY ---------- */
  useEffect(() => {
    if (devices && Object.keys(devices).length > 0) {
      const allDevices = Object.values(devices);
      const backCam = allDevices.find(d => d.position === 'back') || allDevices[0];
      setSelectedDevice(backCam);
    }
  }, [devices]);

  /* ---------- Load FPS info - BACK CAMERA ONLY ---------- */
  useEffect(() => {
    const loadFpsData = async () => {
      try {
        const configs = await CameraFpsModule.getHighSpeedVideoFps();
        // ⭐ Filter to only show back camera (usually camera ID "0")
        const backCameraConfigs = configs.filter(cfg => cfg.cameraId === "0");
        console.log('🎞 Supported High-Speed Configs (Back Camera):');
        backCameraConfigs.forEach(cfg =>
          console.log(`${cfg.width}x${cfg.height} @ ${cfg.fpsMin}-${cfg.fpsMax} FPS`)
        );
        setFpsConfigs(backCameraConfigs || []);
      } catch (err) {
        console.error('❌ Error fetching FPS data:', err);
      }
    };
    loadFpsData();
  }, []);

  /* ---------- Select best format for preview ---------- */
  useEffect(() => {
    if (!selectedDevice) return;
    const formats = selectedDevice.formats || [];
    const best =
      formats.find(f => f.maxFps >= 60) ||
      formats[0];
    setSelectedFormat(best);
    console.log(`🎞 Using preview format: ${best?.videoWidth}×${best?.videoHeight} @ ${best?.maxFps}fps`);
  }, [selectedDevice]);

  /* ---------- Photo Capture ---------- */
  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert('Camera not ready');
        return;
      }

      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'quality' });
      const destDir = `${RNFS.PicturesDirectoryPath}/SlowMoCamera`;
      await RNFS.mkdir(destDir);
      const destPath = `${destDir}/photo_${Date.now()}.jpg`;
      await RNFS.moveFile(photo.path, destPath);
      await CameraRoll.save(destPath, { type: 'photo', album: 'SlowMoCamera' });
      Alert.alert('✅ Photo Saved', destPath);
    } catch (e) {
      console.error('Photo error:', e);
      Alert.alert('Error', e.message);
    }
  };

  /* ---------- Slow-Motion Recording ---------- */
  const startSlowMo = async () => {
    try {
      if (!selectedDevice) {
        Alert.alert('Error', 'No camera selected');
        return;
      }

      const cameraId = selectedDevice.id;
      
      setRecording(true);
      setCameraActive(false);
      
      console.log(`🚀 Starting slow-motion on camera ${cameraId}...`);
      
      const videoPath = await CameraHighSpeedModule.startHighSpeedRecording(
        cameraId,
        TARGET_FPS
      );
      
      console.log('🎥 Recording started at:', videoPath);
      Alert.alert('🎥 Recording Started', `Recording slow-motion video at ${TARGET_FPS} FPS`);
    } catch (err) {
      console.error('Start slow-mo error:', err);
      Alert.alert('❌ Error', err.message);
      setRecording(false);
      setCameraActive(true);
    }
  };

  const stopSlowMo = async () => {
    try {
      const path = await CameraHighSpeedModule.stopHighSpeedRecording();
      console.log('✅ Saved slow-mo video:', path);
      Alert.alert('✅ Saved Slow-Mo', path);
    } catch (err) {
      console.error('Stop slow-mo error:', err);
      Alert.alert('❌ Error', err.message);
    } finally {
      setRecording(false);
      setCameraActive(true);
    }
  };

  if (!hasPermission)
    return (
      <View style={styles.center}>
        <Text>No camera or storage permission</Text>
      </View>
    );

  if (!selectedDevice)
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );

  const maxFps =
    fpsConfigs.length > 0 ? Math.max(...fpsConfigs.map(f => f.fpsMax)) : selectedFormat?.maxFps || 30;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={selectedDevice}
        isActive={cameraActive}
        photo={true}
        video={true}
        format={selectedFormat}
      />

      <View style={styles.controls}>
        {/* ⭐ REMOVED SWITCH CAMERA BUTTON */}

        {!recording ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#28a745' }]}
            onPress={startSlowMo}
          >
            <Text style={styles.buttonText}>🎥 Start Slow-Mo {TARGET_FPS} FPS</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#dc3545' }]}
            onPress={stopSlowMo}
          >
            <Text style={styles.buttonText}>⏹ Stop Slow-Mo</Text>
          </TouchableOpacity>
        )}

        {/* <TouchableOpacity
          style={[styles.button, { backgroundColor: '#007bff' }]}
          onPress={capturePhoto}
        >
          <Text style={styles.buttonText}>📸 Capture Photo</Text>
        </TouchableOpacity> */}
      </View>

      <View style={styles.fpsContainer}>
        <Text
          style={[
            styles.fpsHeader,
            { color: maxFps >= 240 ? '#00ff88' : maxFps >= 120 ? '#ffcc00' : '#fff' },
          ]}
        >
          🎞 Back Camera FPS:{' '}
          {maxFps >= 240
            ? '🚀 240 FPS Ultra Slow-Mo'
            : maxFps >= 120
            ? '⚡ 120 FPS Slow-Mo'
            : '🎬 Standard'}
        </Text>
        <ScrollView style={styles.scroll}>
          {fpsConfigs.map((cfg, i) => (
            <Text key={i} style={styles.fpsText}>
              📱 {cfg.width}×{cfg.height} → {cfg.fpsMin}–{cfg.fpsMax} FPS
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: {
    position: 'absolute',
    bottom: 80,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18 },
  fpsContainer: {
    position: 'absolute',
    top: 40,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 10,
    borderRadius: 10,
  },
  fpsHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  scroll: { maxHeight: 180 },
  fpsText: { color: '#fff', fontSize: 14, marginVertical: 2 },
});