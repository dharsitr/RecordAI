declare module 'react-native' {
  export const StyleSheet: any;
  export const Text: any;
  export const View: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const ActivityIndicator: any;
  export const KeyboardAvoidingView: any;
  export const Platform: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const RefreshControl: any;
  export const SafeAreaView: any;
  export const Image: any;
  export const Alert: any;
  export const DimensionValue: any;
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

declare module 'expo-image-picker' {
  export const requestCameraPermissionsAsync: any;
  export const requestMediaLibraryPermissionsAsync: any;
  export const launchCameraAsync: any;
  export const launchImageLibraryAsync: any;
  export const MediaTypeOptions: any;
}

declare module 'expo-file-system' {
  export const documentDirectory: string;
  export const downloadAsync: any;
}

declare module 'expo-sharing' {
  export const isAvailableAsync: any;
  export const shareAsync: any;
}

declare module '@react-navigation/native' {
  export const NavigationContainer: any;
  export const useNavigation: any;
}

declare module '@react-navigation/native-stack' {
  export const createNativeStackNavigator: any;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: any;
  export default AsyncStorage;
}
