import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { colors } from "@/theme";

function RootNavigator() {
  const { token, cargando } = useAuth();

  // Mientras se restaura la sesión guardada, un splash sencillo.
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.fc} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Sin sesión: login y el enlace de restablecer del correo, que
          justamente se abre cuando el usuario NO puede entrar. */}
      <Stack.Protected guard={!token}>
        <Stack.Screen name="login" />
        <Stack.Screen name="restablecer" />
      </Stack.Protected>
      {/* Con sesión → los tabs y las pantallas que se abren encima */}
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="store/[id]" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="carrito" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="pedido/[id]" />
        <Stack.Screen name="direcciones" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="local-nuevo" />
        <Stack.Screen name="admin/locales" />
        <Stack.Screen name="gestion/[storeId]" />
        <Stack.Screen name="gestion/plato" />
        <Stack.Screen name="gestion/pedidos/[storeId]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}
