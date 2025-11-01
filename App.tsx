import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import CameraRoll from '@react-native-camera-roll/camera-roll';

const { CameraFpsModule } = NativeModules;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const devices = useCameraDevices();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [usingFront, setUsingFront] = useState(true);
  const [fpsConfigs, setFpsConfigs] = useState([]);
  const cameraRef = useRef(null);

  // 🔹 Request camera + storage permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const camStatus = await Camera.requestCameraPermission();
      const grantedCamera = camStatus === 'granted' || camStatus === 'authorized';

      let grantedStorage = true;
      if (Platform.OS === 'android' && Platform.Version < 33) {
        const storage = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to save photos and videos to your gallery.',
            buttonPositive: 'OK',
          }
        );
        grantedStorage = storage === PermissionsAndroid.RESULTS.GRANTED;
      }

      setHasPermission(grantedCamera && grantedStorage);
      console.log('📷 Camera permission:', camStatus, '📂 Storage:', grantedStorage);
    };
    requestPermissions();
  }, []);

  // 🔹 Select front/back camera
  useEffect(() => {
    if (devices && Object.keys(devices).length > 0) {
      const allDevices = Object.values(devices);
      const frontCam = allDevices.find(d => d.position === 'front') || allDevices[1];
      const backCam = allDevices.find(d => d.position === 'back') || allDevices[0];
      const device = usingFront ? frontCam : backCam;
      setSelectedDevice(device);
    }
  }, [devices, usingFront]);

  // 🔹 Fetch FPS configuration from native module
  useEffect(() => {
    const loadFpsData = async () => {
      try {
        const configs = await CameraFpsModule.getHighSpeedVideoFps();
        console.log('🎞️ FPS Configurations:', configs);
        setFpsConfigs(configs || []);
      } catch (err) {
        console.error('❌ Error fetching FPS data:', err);
      }
    };
    loadFpsData();
  }, []);

  // 🔹 Switch camera
  const switchCamera = () => setUsingFront(prev => !prev);

  // 🔹 Capture photo + save to gallery
  const capturePhoto = async () => {
    try {
      if (cameraRef.current == null) {
        Alert.alert('Camera not ready');
        return;
      }

      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
      });

      console.log('📸 Photo captured:', photo);

      // Create Pictures/TestingCamera folder if not exists
      const destDir = `${RNFS.PicturesDirectoryPath}/TestingCamera`;
      await RNFS.mkdir(destDir);
      const destPath = `${destDir}/photo_${Date.now()}.jpg`;

      await RNFS.moveFile(photo.path, destPath);
      console.log('💾 Moved to:', destPath);

      // Register in gallery
      await CameraRoll.save(destPath, { type: 'photo', album: 'TestingCamera' });

      Alert.alert('✅ Photo Saved to Gallery', destPath);
    } catch (error) {
      console.error('❌ Capture error:', error);
      Alert.alert('Error', error.message);
    }
  };

  // 🔹 UI Rendering
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
    

  // 🔹 Determine highest FPS
  const maxFps =
    fpsConfigs.length > 0 ? Math.max(...fpsConfigs.map(f => f.fpsMax)) : 0;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={selectedDevice}
        isActive={true}
        photo={true}
      />

      {/* === Overlay: Controls === */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={switchCamera}>
          <Text style={styles.buttonText}>
            Switch to {usingFront ? 'Back' : 'Front'} Camera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#007bff' }]}
          onPress={capturePhoto}
        >
          <Text style={styles.buttonText}>Capture Photo</Text>
        </TouchableOpacity>
      </View>

      {/* === Overlay: FPS Configurations === */}
      <View style={styles.fpsContainer}>
        <Text
          style={[
            styles.fpsHeader,
            { color: maxFps >= 240 ? '#00ff88' : maxFps >= 120 ? '#ffcc00' : '#fff' },
          ]}
        >
          🎞️ Supported FPS —{' '}
          {maxFps >= 240
            ? '🚀 Ultra Slow-Motion (240 FPS)'
            : maxFps >= 120
            ? '⚡ Slow-Motion (120 FPS)'
            : '🎬 Standard (≤ 60 FPS)'}
        </Text>
        <ScrollView style={styles.scroll}>
          {fpsConfigs.length > 0 ? (
            fpsConfigs.map((cfg, i) => (
              <Text key={i} style={styles.fpsText}>
                📱 Cam {cfg.cameraId}: {cfg.width}×{cfg.height} → {cfg.fpsMin}–
                {cfg.fpsMax} FPS
              </Text>
            ))
          ) : (
            <Text style={styles.fpsTextDim}>Loading FPS data...</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

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
  fpsTextDim: { color: '#bbb', fontSize: 14, textAlign: 'center' },
});
