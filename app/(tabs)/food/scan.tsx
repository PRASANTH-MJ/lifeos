import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components';
import { lookupFoodBarcode } from '@/modules/food';
import { useAppTheme } from '@/theme';

export default function ScanBarcodeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const onScanned = async (result: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setNotFound(false);
    try {
      const product = await lookupFoodBarcode(result.data);
      if (!product) {
        setNotFound(true);
        setScanned(false);
        setLoading(false);
        return;
      }
      router.replace({
        pathname: '/food/new',
        params: {
          date,
          prefillName: product.name,
          prefillCalories: product.caloriesPer100g != null ? String(Math.round(product.caloriesPer100g)) : '',
          prefillProtein: product.proteinPer100g != null ? String(Math.round(product.proteinPer100g)) : '',
          prefillCarbs: product.carbsPer100g != null ? String(Math.round(product.carbsPer100g)) : '',
          prefillFat: product.fatPer100g != null ? String(Math.round(product.fatPer100g)) : '',
        },
      });
    } catch {
      setNotFound(true);
      setScanned(false);
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <ScreenContainer>
        <ActivityIndicator />
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl }}>
          <Ionicons name="camera-outline" size={48} color={theme.colors.textTertiary} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
            Flowsy needs camera access to scan a food barcode.
          </Text>
          <Button label="Allow camera access" onPress={requestPermission} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ title: 'Scan Barcode', headerShown: true }} />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: theme.spacing.md }}>
        {loading ? (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md }}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : notFound ? (
          <Pressable
            onPress={() => setNotFound(false)}
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md }}>
            <Text style={{ color: '#fff' }}>Product not found — tap to try again</Text>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.md }}>
            <Text style={{ color: '#fff' }}>Point your camera at a barcode</Text>
          </View>
        )}
      </View>
    </View>
  );
}
