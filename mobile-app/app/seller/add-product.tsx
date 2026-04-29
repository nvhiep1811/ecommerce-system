import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { productService } from "@/services/productService";
import { uploadProductImage } from "@/services/storageService";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Category {
  id: number;
  name: string;
}

const getImmediatePreviewUri = async (asset: ImagePicker.ImagePickerAsset) => {
  if (Platform.OS === "web") {
    const webAsset = asset as ImagePicker.ImagePickerAsset & {
      file?: File;
    };

    if (webAsset.file) {
      return URL.createObjectURL(webAsset.file);
    }
  }

  return asset.uri;
};

const navigateToSellerHome = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign("/seller");
    return;
  }

  router.replace("/seller" as any);
};

export default function AddProductScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUri, setPreviewUri] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    thumbnail: "",
    sub_category_id: "",
    stock: "",
    unit: "",
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile || profile.role !== "seller") {
      Alert.alert(
        "Access Denied",
        "You do not have permission to access this page",
      );
      router.replace("/(tabs)/profile");
      return;
    }
    loadCategories();
  }, [authLoading, profile]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  const loadCategories = async () => {
    try {
      const cats = await productService.getCategories();
      setCategories(cats);
    } catch (error) {
      void error;
    }
  };

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.description ||
      !formData.price ||
      !formData.sub_category_id ||
      !formData.stock
    ) {
      Alert.alert("Validation Error", "Please fill all required fields");
      return;
    }

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock);
    const subCategoryId = parseInt(formData.sub_category_id);

    if (isNaN(price) || price <= 0) {
      Alert.alert("Validation Error", "Please enter a valid price");
      return;
    }

    if (isNaN(stock) || stock < 0) {
      Alert.alert("Validation Error", "Please enter a valid stock quantity");
      return;
    }

    try {
      setLoading(true);

      const productData = {
        name: formData.name,
        description: formData.description,
        price: price,
        sub_category_id: subCategoryId,
        stock: stock,
        unit: formData.unit || undefined,
        thumbnail: formData.thumbnail || undefined,
      };

      await productService.addProduct(productData);
      navigateToSellerHome();
    } catch (error) {
      void error;
      Alert.alert("Error", "Failed to add product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickThumbnail = async () => {
    try {
      setUploadingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to upload product images.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      const nextPreviewUri = await getImmediatePreviewUri(asset);
      setPreviewUri(nextPreviewUri);

      const uploadedUrl = await uploadProductImage({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });

      setFormData((current) => ({ ...current, thumbnail: uploadedUrl }));
      Alert.alert("Upload Complete", "Image uploaded to Supabase successfully.");
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error instanceof Error ? error.message : "Unable to upload image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const selectedCategory = categories.find(
    (cat) => cat.id.toString() === formData.sub_category_id,
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Product</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter product description"
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Stock Quantity *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={formData.stock}
              onChangeText={(text) => setFormData({ ...formData, stock: text })}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text
                style={
                  selectedCategory
                    ? styles.dropdownText
                    : styles.dropdownPlaceholder
                }
              >
                {selectedCategory ? selectedCategory.name : "Select a category"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., kg, pcs, liters"
              value={formData.unit}
              onChangeText={(text) => setFormData({ ...formData, unit: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Image</Text>
            {previewUri || formData.thumbnail ? (
              <Image
                source={{ uri: previewUri || formData.thumbnail }}
                style={styles.thumbnailPreview}
                contentFit="contain"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image-outline" size={32} color="#9ca3af" />
                <Text style={styles.thumbnailPlaceholderText}>
                  No image selected
                </Text>
              </View>
            )}

            <View style={styles.thumbnailActions}>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  uploadingImage && styles.submitButtonDisabled,
                ]}
                onPress={handlePickThumbnail}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="white" />
                    <Text style={styles.uploadButtonText}>
                      Upload Product Image
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {formData.thumbnail ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setPreviewUri("");
                    setFormData((current) => ({ ...current, thumbnail: "" }));
                  }}
                >
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.helperText}>
              You can upload from your gallery or paste a direct image URL.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="https://example.com/image.jpg"
              value={formData.thumbnail}
              onChangeText={(text) => {
                setPreviewUri(text);
                setFormData({ ...formData, thumbnail: text });
              }}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Add Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      sub_category_id: item.id.toString(),
                    });
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.categoryText}>{item.name}</Text>
                  {formData.sub_category_id === item.id.toString() && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={Colors.light.tint}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={styles.categoryList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  form: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  thumbnailPreview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#f3f4f6",
  },
  thumbnailPlaceholder: {
    height: 220,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 10,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    gap: 8,
  },
  thumbnailPlaceholderText: {
    fontSize: 14,
    color: "#6b7280",
  },
  thumbnailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#0f766e",
  },
  uploadButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  clearButton: {
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  clearButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9f9f9",
  },
  dropdownText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: "#999",
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryText: {
    fontSize: 16,
    color: "#333",
  },
});
