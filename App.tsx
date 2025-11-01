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
  const [usingFront, setUsingFront] = useState(true);
  const [fpsConfigs, setFpsConfigs] = useState([]);
  const cameraRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);

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

  /* ---------- Camera Selection ---------- */
  useEffect(() => {
    if (devices && Object.keys(devices).length > 0) {
      const allDevices = Object.values(devices);
      const frontCam = allDevices.find(d => d.position === 'front') || allDevices[1];
      const backCam = allDevices.find(d => d.position === 'back') || allDevices[0];
      const device = usingFront ? frontCam : backCam;
      setSelectedDevice(device);
    }
  }, [devices, usingFront]);

  /* ---------- Load FPS info ---------- */
  useEffect(() => {
    const loadFpsData = async () => {
      try {
        const configs = await CameraFpsModule.getHighSpeedVideoFps();
        console.log('🎞 Supported High-Speed Configs:');
        configs.forEach(cfg =>
          console.log(`Cam ${cfg.cameraId}: ${cfg.width}x${cfg.height} @ ${cfg.fpsMin}-${cfg.fpsMax}`)
        );
        setFpsConfigs(configs || []);
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

  const switchCamera = () => setUsingFront(prev => !prev);

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
      setRecording(true);
      console.log('🚀 Starting true slow-motion recording...');
      const videoPath = await CameraHighSpeedModule.startHighSpeedRecording(120);
      console.log('🎥 Recording started at:', videoPath);
      Alert.alert('🎥 Recording Started', 'Recording slow-motion video at 240 FPS');
    } catch (err) {
      console.error('Start slow-mo error:', err);
      Alert.alert('❌ Error', err.message);
      setRecording(false);
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
        isActive={true}
        photo={true}
        video={true}
        format={selectedFormat}
      />

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={switchCamera}>
          <Text style={styles.buttonText}>
            Switch to {usingFront ? 'Back' : 'Front'}
          </Text>
        </TouchableOpacity>

        {!recording ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#28a745' }]}
            onPress={startSlowMo}
          >
            <Text style={styles.buttonText}>🎥 Start Slow-Mo 240 FPS</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#dc3545' }]}
            onPress={stopSlowMo}
          >
            <Text style={styles.buttonText}>⏹ Stop Slow-Mo</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#007bff' }]}
          onPress={capturePhoto}
        >
          <Text style={styles.buttonText}>📸 Capture Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fpsContainer}>
        <Text
          style={[
            styles.fpsHeader,
            { color: maxFps >= 240 ? '#00ff88' : maxFps >= 120 ? '#ffcc00' : '#fff' },
          ]}
        >
          🎞 Supported FPS:{' '}
          {maxFps >= 240
            ? '🚀 240 FPS Ultra Slow-Mo'
            : maxFps >= 120
            ? '⚡ 120 FPS Slow-Mo'
            : '🎬 Standard'}
        </Text>
        <ScrollView style={styles.scroll}>
          {fpsConfigs.map((cfg, i) => (
            <Text key={i} style={styles.fpsText}>
              📱 Cam {cfg.cameraId}: {cfg.width}×{cfg.height} → {cfg.fpsMin}–{cfg.fpsMax} FPS
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
