import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const devices = useCameraDevices();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [usingFront, setUsingFront] = useState(true); // toggle flag

  useEffect(() => {
    const requestPermissions = async () => {
      const status = await Camera.requestCameraPermission();
      console.log('📷 Camera permission status:', status);
      setHasPermission(status === 'authorized' || status === 'granted');
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    if (devices && Object.keys(devices).length > 0) {
      const allDevices = Object.values(devices);
      console.log('📱 Available devices:', allDevices);

      // Set initial camera: front (index 1) or fallback to back (index 0)
      const frontCam = allDevices.find(d => d.position === 'front') || allDevices[1];
      const backCam = allDevices.find(d => d.position === 'back') || allDevices[0];
      setSelectedDevice(usingFront ? frontCam : backCam);
    }
  }, [devices, usingFront]);

  const switchCamera = () => {
    setUsingFront(prev => !prev);
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>No camera permission</Text>
      </View>
    );
  }

  if (!selectedDevice) {
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={selectedDevice}
        isActive={true}
      />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={switchCamera}>
          <Text style={styles.buttonText}>
            Switch to {usingFront ? 'Back' : 'Front'} Camera
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontSize: 18 },
});
