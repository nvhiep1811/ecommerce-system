import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { addressService } from "@/services/addressService";
import {
  VietnamDistrict,
  vietnamAddressService,
  VietnamProvince,
  VietnamWard,
} from "@/services/vietnamAddressService";
import { Address } from "@/types/address";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

const DEFAULT_FORM_DATA = {
  full_name: "",
  phone: "",
  address_line: "",
  city: "",
  postal_code: "",
};

type AddressFormErrors = {
  full_name?: string;
  phone?: string;
  address_line?: string;
  province?: string;
  district?: string;
  ward?: string;
  city?: string;
  postal_code?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const composeCityValue = (districtName: string, wardName: string) => {
  const trimmedDistrict = districtName.trim();
  const trimmedWard = wardName.trim();

  if (trimmedDistrict && trimmedWard) {
    return `${trimmedDistrict}, ${trimmedWard}`;
  }

  return trimmedDistrict;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const normalizePhone = (value: string) => value.replace(/\s+/g, "").trim();

const isValidPhone = (value: string) => /^(0|\+84)\d{9}$/.test(value);

const getCityProvinceText = (city?: string, province?: string) => {
  const c = (city || "").trim();
  const p = (province || "").trim();

  if (c && p && c.toLowerCase() !== p.toLowerCase()) {
    return `${c}, ${p}`;
  }

  return c || p || "-";
};

export default function OrderAddressesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    selected,
    selectedAddressId,
    buyNowProductId,
    buyNowQuantity,
    flashSaleCampaignId,
    flashSaleItemId,
    flashSaleReservationToken,
    flashSalePrice,
  } = useLocalSearchParams<{
    selected?: string;
    selectedAddressId?: string;
    buyNowProductId?: string;
    buyNowQuantity?: string;
    flashSaleCampaignId?: string;
    flashSaleItemId?: string;
    flashSaleReservationToken?: string;
    flashSalePrice?: string;
  }>();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [provinceError, setProvinceError] = useState("");
  const [provinces, setProvinces] = useState<VietnamProvince[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [districtError, setDistrictError] = useState("");
  const [districts, setDistricts] = useState<VietnamDistrict[]>([]);
  const [wardLoading, setWardLoading] = useState(false);
  const [wardError, setWardError] = useState("");
  const [wards, setWards] = useState<VietnamWard[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteAddressId, setPendingDeleteAddressId] = useState<
    number | null
  >(null);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<
    number | null
  >(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<
    number | null
  >(null);
  const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
  const [provinceQuery, setProvinceQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [wardQuery, setWardQuery] = useState("");
  const [manualProvinceName, setManualProvinceName] = useState("");
  const [prefillCityText, setPrefillCityText] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<AddressFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const provinceListRef = useRef<ScrollView | null>(null);
  const districtListRef = useRef<ScrollView | null>(null);
  const wardListRef = useRef<ScrollView | null>(null);
  const provinceItemYRef = useRef<Record<number, number>>({});
  const districtItemYRef = useRef<Record<number, number>>({});
  const wardItemYRef = useRef<Record<number, number>>({});
  const fullNameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const addressLineInputRef = useRef<TextInput>(null);
  const postalCodeInputRef = useRef<TextInput>(null);

  const initialAddressId = useMemo(() => {
    if (!selectedAddressId) {
      return null;
    }

    const parsed = Number(
      Array.isArray(selectedAddressId)
        ? selectedAddressId[0]
        : selectedAddressId,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [selectedAddressId]);

  const selectedRaw = useMemo(
    () => (Array.isArray(selected) ? selected[0] : selected),
    [selected],
  );

  const buyNowProductIdRaw = useMemo(
    () =>
      Array.isArray(buyNowProductId) ? buyNowProductId[0] : buyNowProductId,
    [buyNowProductId],
  );

  const buyNowQuantityRaw = useMemo(
    () => (Array.isArray(buyNowQuantity) ? buyNowQuantity[0] : buyNowQuantity),
    [buyNowQuantity],
  );

  const flashSaleCampaignIdRaw = useMemo(
    () =>
      Array.isArray(flashSaleCampaignId)
        ? flashSaleCampaignId[0]
        : flashSaleCampaignId,
    [flashSaleCampaignId],
  );

  const flashSaleItemIdRaw = useMemo(
    () => (Array.isArray(flashSaleItemId) ? flashSaleItemId[0] : flashSaleItemId),
    [flashSaleItemId],
  );

  const flashSaleReservationTokenRaw = useMemo(
    () =>
      Array.isArray(flashSaleReservationToken)
        ? flashSaleReservationToken[0]
        : flashSaleReservationToken,
    [flashSaleReservationToken],
  );

  const flashSalePriceRaw = useMemo(
    () => (Array.isArray(flashSalePrice) ? flashSalePrice[0] : flashSalePrice),
    [flashSalePrice],
  );

  const filteredProvinces = useMemo(() => {
    const keyword = normalizeSearchText(provinceQuery);
    if (!keyword) {
      return provinces;
    }

    return provinces.filter((province) =>
      normalizeSearchText(province.name).includes(keyword),
    );
  }, [provinceQuery, provinces]);

  const filteredDistricts = useMemo(() => {
    const keyword = normalizeSearchText(districtQuery);
    if (!keyword) {
      return districts;
    }

    return districts.filter((district) =>
      normalizeSearchText(district.name).includes(keyword),
    );
  }, [districtQuery, districts]);

  const filteredWards = useMemo(() => {
    const keyword = normalizeSearchText(wardQuery);
    if (!keyword) {
      return wards;
    }

    return wards.filter((ward) =>
      normalizeSearchText(ward.name).includes(keyword),
    );
  }, [wardQuery, wards]);

  const isEditing = editingAddressId !== null;
  const provinceFallbackMode =
    Boolean(provinceError) || (!provinceLoading && provinces.length === 0);
  const cityFallbackMode =
    provinceFallbackMode ||
    Boolean(districtError) ||
    Boolean(wardError) ||
    (!districtLoading &&
      selectedProvinceCode !== null &&
      districts.length === 0);

  const selectedProvinceName = useMemo(
    () =>
      provinces.find((province) => province.code === selectedProvinceCode)
        ?.name || "Not selected",
    [provinces, selectedProvinceCode],
  );

  const selectedDistrictName = useMemo(
    () =>
      districts.find((district) => district.code === selectedDistrictCode)
        ?.name || "Not selected",
    [districts, selectedDistrictCode],
  );

  const selectedWardName = useMemo(
    () =>
      wards.find((ward) => ward.code === selectedWardCode)?.name ||
      "Not selected",
    [selectedWardCode, wards],
  );

  const refreshAddresses = useCallback(
    async (preferredAddressId?: number | null) => {
      if (!user?.id) {
        return;
      }

      const data = await addressService.getAddressesByUser(user.id);
      let normalized = data;

      if (normalized.length === 1 && !normalized[0].is_default) {
        try {
          const updated = await addressService.setDefaultAddress(
            user.id,
            normalized[0].id,
          );
          normalized = [updated];
        } catch (error) {
          void error;
        }
      }

      setAddresses(normalized);

      if (
        preferredAddressId &&
        normalized.some((address) => address.id === preferredAddressId)
      ) {
        setSelectedAddress(preferredAddressId);
        return;
      }

      const defaultAddress = normalized.find((address) => address.is_default);
      setSelectedAddress(defaultAddress?.id || normalized[0]?.id || null);
    },
    [user?.id],
  );

  useEffect(() => {
    const bootstrap = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        await refreshAddresses(initialAddressId);
      } catch (error) {
        setToast({
          message: getErrorMessage(error, "Không thể tải địa chỉ"),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [initialAddressId, refreshAddresses, user?.id]);

  const closeModal = () => {
    setModalVisible(false);
    setEditingAddressId(null);
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    setDistrictError("");
    setWardError("");
    setProvinceQuery("");
    setDistrictQuery("");
    setWardQuery("");
    setManualProvinceName("");
    setPrefillCityText(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    fullNameInputRef.current = null;
    phoneInputRef.current = null;
    addressLineInputRef.current = null;
    postalCodeInputRef.current = null;
  };

  const openAddModal = () => {
    setEditingAddressId(null);
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    setDistrictError("");
    setWardError("");
    setProvinceQuery("");
    setDistrictQuery("");
    setWardQuery("");
    setManualProvinceName("");
    setPrefillCityText(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setModalVisible(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddressId(address.id);
    setFormData({
      full_name: address.full_name,
      phone: address.phone,
      address_line: address.address_line,
      city: address.city,
      postal_code: address.postal_code,
    });

    const province = vietnamAddressService.findProvinceByName(
      provinces,
      address.province || "",
    );
    setSelectedProvinceCode(province?.code || null);
    setManualProvinceName(address.province || "");
    setProvinceQuery("");
    setDistrictQuery("");
    setWardQuery("");
    setFormErrors({});

    // Reset states trước
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    setDistrictError("");
    setWardError("");
    setPrefillCityText(null);

    // Async load districts & wards để pre-fill đầy đủ
    if (province?.code) {
      (async () => {
        try {
          // Load districts
          const districtsData =
            await vietnamAddressService.getDistrictsByProvince(province.code);
          setDistricts(districtsData);

          // Tìm district match từ address.district (safe normalize)
          let selectedDist: VietnamDistrict | undefined;
          const districtName = (address.district ?? "").trim().toLowerCase();
          if (districtName) {
            selectedDist = districtsData.find(
              (d) => d.name.toLowerCase() === districtName,
            );
          }

          if (selectedDist) {
            setSelectedDistrictCode(selectedDist.code);

            // Load wards cho district này
            try {
              const wardsData = await vietnamAddressService.getWardsByDistrict(
                selectedDist.code,
              );
              setWards(wardsData);

              // Tìm ward match từ address.ward (safe normalize)
              const wardName = (address.ward ?? "").trim().toLowerCase();
              if (wardName) {
                const selectedWard = wardsData.find(
                  (w) => w.name.toLowerCase() === wardName,
                );
                if (selectedWard) {
                  setSelectedWardCode(selectedWard.code);
                }
              }
            } catch (error) {
              console.error("Không thể tải phường/xã:", error);
              setWards([]);
            }
          }
        } catch (error) {
          console.error("Không thể tải quận/huyện:", error);
          setDistricts([]);
        }
      })();
    }

    setModalVisible(true);
  };

  const validateForm = (): boolean => {
    const errors: AddressFormErrors = {};

    if (!formData.full_name.trim()) {
      errors.full_name = "Vui lòng nhập họ tên.";
    }

    const normalized = normalizePhone(formData.phone);
    if (!normalized) {
      errors.phone = "Vui lòng nhập số điện thoại.";
    } else if (!isValidPhone(normalized)) {
      errors.phone = "Số điện thoại cần có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.";
    }

    if (!formData.address_line.trim()) {
      errors.address_line = "Vui lòng nhập địa chỉ cụ thể.";
    }

    const provinceName =
      provinces.find((province) => province.code === selectedProvinceCode)
        ?.name || manualProvinceName.trim();
    if (!provinceName) {
      errors.province = "Vui lòng chọn tỉnh/thành phố.";
    }

    if (!cityFallbackMode) {
      if (!selectedDistrictCode) {
        errors.district = "Vui lòng chọn quận/huyện.";
      }

      if (!selectedWardCode) {
        errors.ward = "Vui lòng chọn phường/xã.";
      }
    }

    if (!formData.city.trim()) {
      errors.city = "Vui lòng nhập quận/huyện hoặc thành phố.";
    }

    if (
      formData.postal_code.trim() &&
      !/^\d{5,6}$/.test(formData.postal_code.trim())
    ) {
      errors.postal_code = "Mã bưu chính cần gồm 5-6 chữ số.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRetryProvinceLoad = async () => {
    setProvinceLoading(true);
    setProvinceError("");

    try {
      const data = await vietnamAddressService.getProvinces();
      setProvinces(data);
    } catch (error) {
      setProvinceError(getErrorMessage(error, "Không thể tải tỉnh/thành phố"));
    } finally {
      setProvinceLoading(false);
    }
  };

  const handleRetryDistrictLoad = async () => {
    if (!selectedProvinceCode) {
      return;
    }

    setDistrictLoading(true);
    setDistrictError("");

    try {
      const data =
        await vietnamAddressService.getDistrictsByProvince(
          selectedProvinceCode,
        );
      setDistricts(data);
    } catch (error) {
      setDistrictError(getErrorMessage(error, "Không thể tải quận/huyện"));
    } finally {
      setDistrictLoading(false);
    }
  };

  const handleRetryWardLoad = async () => {
    if (!selectedDistrictCode) {
      return;
    }

    setWardLoading(true);
    setWardError("");

    try {
      const data =
        await vietnamAddressService.getWardsByDistrict(selectedDistrictCode);
      setWards(data);
    } catch (error) {
      setWardError(getErrorMessage(error, "Không thể tải phường/xã"));
    } finally {
      setWardLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadProvinces = async () => {
      try {
        const data = await vietnamAddressService.getProvinces();
        if (!mounted) {
          return;
        }

        setProvinces(data);
        setProvinceError("");
      } catch (error) {
        if (!mounted) {
          return;
        }

        setProvinceError(
          getErrorMessage(error, "Không thể tải tỉnh/thành phố"),
        );
      } finally {
        if (mounted) {
          setProvinceLoading(false);
        }
      }
    };

    void loadProvinces();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!modalVisible || !selectedProvinceCode) {
      setDistricts([]);
      setSelectedDistrictCode(null);
      setWards([]);
      setSelectedWardCode(null);
      setDistrictError("");
      setWardError("");
      return;
    }

    let mounted = true;

    const loadDistricts = async () => {
      setDistrictLoading(true);
      setDistrictError("");
      setWards([]);
      setSelectedWardCode(null);

      try {
        const data =
          await vietnamAddressService.getDistrictsByProvince(
            selectedProvinceCode,
          );
        if (!mounted) {
          return;
        }

        setDistricts(data);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setDistricts([]);
        setDistrictError(getErrorMessage(error, "Không thể tải quận/huyện"));
      } finally {
        if (mounted) {
          setDistrictLoading(false);
        }
      }
    };

    void loadDistricts();

    return () => {
      mounted = false;
    };
  }, [modalVisible, selectedProvinceCode]);

  useEffect(() => {
    if (!modalVisible || !selectedDistrictCode) {
      setWards([]);
      setSelectedWardCode(null);
      setWardError("");
      return;
    }

    let mounted = true;

    const loadWards = async () => {
      setWardLoading(true);
      setWardError("");

      try {
        const data =
          await vietnamAddressService.getWardsByDistrict(selectedDistrictCode);
        if (!mounted) {
          return;
        }

        setWards(data);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setWards([]);
        setWardError(getErrorMessage(error, "Không thể tải phường/xã"));
      } finally {
        if (mounted) {
          setWardLoading(false);
        }
      }
    };

    void loadWards();

    return () => {
      mounted = false;
    };
  }, [modalVisible, selectedDistrictCode]);

  useEffect(() => {
    if (
      !modalVisible ||
      !prefillCityText ||
      selectedDistrictCode ||
      !districts.length
    ) {
      return;
    }

    const district = vietnamAddressService.findDistrictFromText(
      districts,
      prefillCityText,
    );
    if (district) {
      setSelectedDistrictCode(district.code);
    }
  }, [districts, modalVisible, prefillCityText, selectedDistrictCode]);

  useEffect(() => {
    if (
      !modalVisible ||
      !prefillCityText ||
      !selectedDistrictCode ||
      wardLoading
    ) {
      return;
    }

    if (wards.length > 0) {
      const ward = vietnamAddressService.findWardFromText(
        wards,
        prefillCityText,
      );
      if (ward) {
        setSelectedWardCode(ward.code);
      }
    }

    setPrefillCityText(null);
  }, [modalVisible, prefillCityText, selectedDistrictCode, wardLoading, wards]);

  useEffect(() => {
    if (!modalVisible || !selectedDistrictCode) {
      return;
    }

    const districtName =
      districts.find((district) => district.code === selectedDistrictCode)
        ?.name || "";
    const wardName =
      wards.find((ward) => ward.code === selectedWardCode)?.name || "";
    const nextCity = composeCityValue(districtName, wardName);

    setFormData((prev) =>
      prev.city === nextCity
        ? prev
        : {
            ...prev,
            city: nextCity,
          },
    );
  }, [districts, modalVisible, selectedDistrictCode, selectedWardCode, wards]);

  useEffect(() => {
    if (!modalVisible || !selectedProvinceCode) {
      return;
    }

    const y = provinceItemYRef.current[selectedProvinceCode];
    if (typeof y !== "number") {
      return;
    }

    requestAnimationFrame(() => {
      provinceListRef.current?.scrollTo({
        y: Math.max(y - 8, 0),
        animated: true,
      });
    });
  }, [filteredProvinces, modalVisible, selectedProvinceCode]);

  useEffect(() => {
    if (!modalVisible || !selectedDistrictCode) {
      return;
    }

    const y = districtItemYRef.current[selectedDistrictCode];
    if (typeof y !== "number") {
      return;
    }

    requestAnimationFrame(() => {
      districtListRef.current?.scrollTo({
        y: Math.max(y - 8, 0),
        animated: true,
      });
    });
  }, [filteredDistricts, modalVisible, selectedDistrictCode]);

  useEffect(() => {
    if (!modalVisible || !selectedWardCode) {
      return;
    }

    const y = wardItemYRef.current[selectedWardCode];
    if (typeof y !== "number") {
      return;
    }

    requestAnimationFrame(() => {
      wardListRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
    });
  }, [filteredWards, modalVisible, selectedWardCode]);

  const handleSelectProvince = (provinceCode: number) => {
    setSelectedProvinceCode(provinceCode);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    setDistrictError("");
    setWardError("");
    setDistrictQuery("");
    setWardQuery("");
    setManualProvinceName("");
    setPrefillCityText(null);
    setFormData((prev) => ({ ...prev, city: "" }));
  };

  const handleSelectDistrict = (districtCode: number) => {
    setSelectedDistrictCode(districtCode);
    setSelectedWardCode(null);
    setWards([]);
    setWardError("");
    setWardQuery("");
  };

  const handleSelectWard = (wardCode: number) => {
    setSelectedWardCode(wardCode);
  };

  const handleSaveAddress = async () => {
    if (!user?.id) {
      return;
    }

    if (!validateForm()) {
      setToast({
        message: "Vui lòng kiểm tra các trường được đánh dấu.",
        type: "error",
      });
      // Focus on first error input
      if (formErrors.full_name) {
        fullNameInputRef.current?.focus();
      } else if (formErrors.phone) {
        phoneInputRef.current?.focus();
      } else if (formErrors.address_line) {
        addressLineInputRef.current?.focus();
      } else if (formErrors.postal_code) {
        postalCodeInputRef.current?.focus();
      }
      return;
    }

    const provinceName =
      provinces.find((province) => province.code === selectedProvinceCode)
        ?.name || manualProvinceName.trim();
    const selectedDistrictName =
      districts.find((district) => district.code === selectedDistrictCode)
        ?.name || null;
    const selectedWardName =
      wards.find((ward) => ward.code === selectedWardCode)?.name || null;
    const cityValue = formData.city.trim();

    if (!provinceName || !cityValue) {
      setToast({
        message: "Vui lòng nhập tỉnh/thành phố và quận/huyện",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        full_name: formData.full_name.trim(),
        phone: normalizePhone(formData.phone),
        address_line: formData.address_line.trim(),
        ward: selectedWardName || undefined,
        district: selectedDistrictName || undefined,
        city: cityValue,
        province: provinceName,
        postal_code: formData.postal_code.trim(),
        country: "Vietnam",
      };

      if (isEditing && editingAddressId) {
        const current = addresses.find(
          (address) => address.id === editingAddressId,
        );
        await addressService.updateAddress(editingAddressId, {
          ...payload,
          is_default: current?.is_default,
        });
        await refreshAddresses(editingAddressId);
      } else {
        const created = await addressService.createAddress({
          user_id: user.id,
          ...payload,
          is_default: addresses.length === 0,
        });
        await refreshAddresses(created.id);
      }

      closeModal();
    } catch (error) {
      setToast({
        message: getErrorMessage(error, "Không thể lưu địa chỉ"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    if (!user?.id) {
      return;
    }

    try {
      await addressService.setDefaultAddress(user.id, id);
      await refreshAddresses(id);
    } catch (error) {
      setToast({
        message: getErrorMessage(error, "Không thể đặt địa chỉ mặc định"),
        type: "error",
      });
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (addresses.length <= 1) {
      setToast({
        message: "Bạn cần có ít nhất một địa chỉ giao hàng.",
        type: "error",
      });
      return;
    }

    setPendingDeleteAddressId(id);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteAddress = async () => {
    if (!pendingDeleteAddressId) {
      setDeleteModalVisible(false);
      return;
    }

    const id = pendingDeleteAddressId;

    const executeDelete = async () => {
      try {
        // Delete address first
        await addressService.deleteAddress(id);

        // Fetch latest addresses from server to determine default state
        if (user?.id) {
          const latest = await addressService.getAddressesByUser(user.id);

          const hasDefault = latest.some((a) => a.is_default);
          if (!hasDefault && latest.length > 0) {
            // Try to set the first remaining address as default
            try {
              await addressService.setDefaultAddress(user.id, latest[0].id);
            } catch (err) {
              console.error("Không thể đặt địa chỉ mặc định dự phòng:", err);
            }
          }
        }

        // Refresh UI state
        await refreshAddresses(selectedAddress === id ? null : selectedAddress);
        setDeleteModalVisible(false);
        setPendingDeleteAddressId(null);
      } catch (error) {
        setToast({
          message: getErrorMessage(error, "Không thể xóa địa chỉ"),
          type: "error",
        });
      }
    };

    void executeDelete();
  };

  const buildInvoiceRoute = () => {
    const selectedParam = selectedRaw?.trim();

    return {
      pathname: "/orders/invoice",
      params: {
        ...(selectedParam ? { selected: selectedParam } : {}),
        ...(selectedAddress ? { addressId: String(selectedAddress) } : {}),
        ...(buyNowProductIdRaw ? { buyNowProductId: buyNowProductIdRaw } : {}),
        ...(buyNowQuantityRaw ? { buyNowQuantity: buyNowQuantityRaw } : {}),
        ...(flashSaleCampaignIdRaw
          ? { flashSaleCampaignId: flashSaleCampaignIdRaw }
          : {}),
        ...(flashSaleItemIdRaw ? { flashSaleItemId: flashSaleItemIdRaw } : {}),
        ...(flashSaleReservationTokenRaw
          ? { flashSaleReservationToken: flashSaleReservationTokenRaw }
          : {}),
        ...(flashSalePriceRaw ? { flashSalePrice: flashSalePriceRaw } : {}),
      },
    } as const;
  };

  const handleUseSelectedAddress = () => {
    router.dismissTo(buildInvoiceRoute());
  };

  const handleBackToInvoice = () => {
    router.dismissTo(buildInvoiceRoute());
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={handleBackToInvoice}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Địa chỉ giao hàng</Text>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={openAddModal} style={styles.backButton}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {addresses.length <= 1 ? (
          <Text style={styles.singleAddressHint}>
            Bạn chỉ có một địa chỉ. Để thêm địa chỉ mới, hãy nhấn nút
            &quot;+&quot; button above.
          </Text>
        ) : null}

        {addresses.map((address) => (
          <View
            key={address.id}
            style={[
              styles.addressCard,
              selectedAddress === address.id && styles.addressCardSelected,
            ]}
          >
            <TouchableOpacity
              style={styles.addressSelectArea}
              onPress={() => setSelectedAddress(address.id)}
              activeOpacity={0.8}
            >
              <View style={styles.addressRow}>
                <View style={styles.radio}>
                  {selectedAddress === address.id ? (
                    <View style={styles.radioDot} />
                  ) : null}
                </View>
                <View style={styles.addressBody}>
                  <View style={styles.addressTitleRow}>
                    <Text style={styles.addressName}>{address.full_name}</Text>
                    {address.is_default ? (
                      <Text style={styles.defaultTag}>Mặc định</Text>
                    ) : null}
                  </View>
                  <Text style={styles.addressMeta}>{address.phone}</Text>
                  <Text style={styles.addressMeta}>
                    Địa chỉ: {address.address_line || "-"}
                  </Text>
                  <Text style={styles.addressMeta}>
                    Phường/xã: {address.ward || "-"}
                  </Text>
                  <Text style={styles.addressMeta}>
                    Quận/huyện: {address.district || "-"}
                  </Text>
                  <Text style={styles.addressMeta}>
                    Tỉnh/thành phố:{" "}
                    {getCityProvinceText(address.city, address.province)}
                  </Text>
                  <Text style={styles.addressMeta}>
                    Mã bưu chính: {address.postal_code || "-"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              {!address.is_default ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSetDefaultAddress(address.id)}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={14}
                    color={Colors.light.tint}
                  />
                  <Text style={styles.actionText}>Set default</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  openEditModal(address);
                }}
              >
                <Ionicons name="create-outline" size={14} color="#2563eb" />
                <Text style={styles.actionText}>Sửa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  addresses.length <= 1 && styles.actionButtonDisabled,
                ]}
                disabled={addresses.length <= 1}
                onPress={() => handleDeleteAddress(address.id)}
              >
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color={addresses.length <= 1 ? "#9ca3af" : "#dc2626"}
                />
                <Text
                  style={[
                    styles.actionText,
                    addresses.length <= 1 && styles.actionTextDisabled,
                  ]}
                >
                  Xóa
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.useAddressButton,
            selectedAddress === null && styles.useAddressButtonDisabled,
          ]}
          disabled={selectedAddress === null}
          onPress={handleUseSelectedAddress}
        >
          <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
          <Text style={styles.useAddressButtonText}>
            {selectedAddress === null
              ? "Vui lòng chọn địa chỉ"
              : "Dùng địa chỉ này"}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEditing ? "Sửa địa chỉ" : "Thêm địa chỉ"}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={[
              styles.modalScrollContent,
              {
                paddingBottom: 16 + Math.max(insets.bottom, 8),
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              ref={fullNameInputRef}
              style={[styles.input, formErrors.full_name && styles.inputError]}
              placeholder="Họ và tên"
              value={formData.full_name}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, full_name: text }));
                setFormErrors((prev) => ({ ...prev, full_name: undefined }));
              }}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phoneInputRef.current?.focus()}
              autoComplete="name"
              textContentType="name"
              editable={!saving}
            />
            {formErrors.full_name ? (
              <Text style={styles.fieldErrorText}>{formErrors.full_name}</Text>
            ) : null}
            <TextInput
              ref={phoneInputRef}
              style={[styles.input, formErrors.phone && styles.inputError]}
              placeholder="Số điện thoại"
              value={formData.phone}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, phone: text }));
                setFormErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => addressLineInputRef.current?.focus()}
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!saving}
            />
            {formErrors.phone ? (
              <Text style={styles.fieldErrorText}>{formErrors.phone}</Text>
            ) : null}
            <Text style={styles.label}>Tỉnh/thành phố</Text>
            {formErrors.province ? (
              <Text style={styles.fieldErrorText}>{formErrors.province}</Text>
            ) : null}
            {provinceError ? (
              <View style={styles.errorLineWrap}>
                <Text style={styles.provinceErrorText}>{provinceError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryProvinceLoad}
                >
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {provinceFallbackMode ? (
              <TextInput
                style={[styles.input, formErrors.province && styles.inputError]}
                placeholder="Nhập tỉnh/thành phố thủ công"
                value={manualProvinceName}
                onChangeText={setManualProvinceName}
              />
            ) : null}
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, styles.searchInputFlex]}
                placeholder="Tìm tỉnh/thành phố..."
                value={provinceQuery}
                onChangeText={setProvinceQuery}
                editable={!provinceFallbackMode}
              />
              {provinceQuery ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setProvinceQuery("")}
                >
                  <Ionicons name="close-circle" size={18} color="#6b7280" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.selectedInfoRow}>
              <Text style={styles.selectedInfoLabel}>Đã chọn:</Text>
              <Text style={styles.selectedInfoValue}>
                {selectedProvinceName}
              </Text>
            </View>
            <View
              style={[
                styles.optionList,
                formErrors.province && styles.selectError,
              ]}
            >
              <ScrollView
                ref={provinceListRef}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {provinceLoading ? (
                  <View style={styles.provinceLoadingWrap}>
                    <ActivityIndicator size="small" color={Colors.light.tint} />
                    <Text style={styles.provinceLoadingText}>
                      Đang tải tỉnh/thành phố...
                    </Text>
                  </View>
                ) : null}

                {!provinceLoading && provinces.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có dữ liệu tỉnh/thành phố từ API
                  </Text>
                ) : null}

                {!provinceLoading &&
                provinces.length > 0 &&
                filteredProvinces.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có kết quả phù hợp
                  </Text>
                ) : null}

                {filteredProvinces.map((province) => (
                  <TouchableOpacity
                    key={province.code}
                    style={[
                      styles.optionItem,
                      selectedProvinceCode === province.code &&
                        styles.optionItemActive,
                    ]}
                    onLayout={(event) => {
                      provinceItemYRef.current[province.code] =
                        event.nativeEvent.layout.y;
                    }}
                    onPress={() => handleSelectProvince(province.code)}
                  >
                    <View style={styles.optionItemRow}>
                      {selectedProvinceCode === province.code ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="white"
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={16}
                          color="#9ca3af"
                        />
                      )}
                      <Text
                        style={[
                          styles.optionText,
                          selectedProvinceCode === province.code &&
                            styles.optionTextActive,
                        ]}
                      >
                        {province.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.label}>Quận/huyện</Text>
            {formErrors.district ? (
              <Text style={styles.fieldErrorText}>{formErrors.district}</Text>
            ) : null}
            {districtError ? (
              <View style={styles.errorLineWrap}>
                <Text style={styles.provinceErrorText}>{districtError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryDistrictLoad}
                >
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, styles.searchInputFlex]}
                placeholder="Tìm quận/huyện..."
                value={districtQuery}
                onChangeText={setDistrictQuery}
                editable={Boolean(selectedProvinceCode)}
              />
              {districtQuery ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setDistrictQuery("")}
                >
                  <Ionicons name="close-circle" size={18} color="#6b7280" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.selectedInfoRow}>
              <Text style={styles.selectedInfoLabel}>Đã chọn:</Text>
              <Text style={styles.selectedInfoValue}>
                {selectedDistrictName}
              </Text>
            </View>
            <View
              style={[
                styles.optionList,
                formErrors.district && styles.selectError,
              ]}
            >
              <ScrollView
                ref={districtListRef}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {districtLoading ? (
                  <View style={styles.provinceLoadingWrap}>
                    <ActivityIndicator size="small" color={Colors.light.tint} />
                    <Text style={styles.provinceLoadingText}>
                      Đang tải quận/huyện...
                    </Text>
                  </View>
                ) : null}

                {!districtLoading &&
                selectedProvinceCode &&
                districts.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có dữ liệu quận/huyện
                  </Text>
                ) : null}

                {!districtLoading &&
                selectedProvinceCode &&
                districts.length > 0 &&
                filteredDistricts.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có kết quả phù hợp
                  </Text>
                ) : null}

                {filteredDistricts.map((district) => (
                  <TouchableOpacity
                    key={district.code}
                    style={[
                      styles.optionItem,
                      selectedDistrictCode === district.code &&
                        styles.optionItemActive,
                    ]}
                    onLayout={(event) => {
                      districtItemYRef.current[district.code] =
                        event.nativeEvent.layout.y;
                    }}
                    onPress={() => handleSelectDistrict(district.code)}
                  >
                    <View style={styles.optionItemRow}>
                      {selectedDistrictCode === district.code ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="white"
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={16}
                          color="#9ca3af"
                        />
                      )}
                      <Text
                        style={[
                          styles.optionText,
                          selectedDistrictCode === district.code &&
                            styles.optionTextActive,
                        ]}
                      >
                        {district.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.label}>Phường/xã</Text>
            {formErrors.ward ? (
              <Text style={styles.fieldErrorText}>{formErrors.ward}</Text>
            ) : null}
            {wardError ? (
              <View style={styles.errorLineWrap}>
                <Text style={styles.provinceErrorText}>{wardError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryWardLoad}
                >
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, styles.searchInputFlex]}
                placeholder="Tìm phường/xã..."
                value={wardQuery}
                onChangeText={setWardQuery}
                editable={Boolean(selectedDistrictCode)}
              />
              {wardQuery ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setWardQuery("")}
                >
                  <Ionicons name="close-circle" size={18} color="#6b7280" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.selectedInfoRow}>
              <Text style={styles.selectedInfoLabel}>Đã chọn:</Text>
              <Text style={styles.selectedInfoValue}>{selectedWardName}</Text>
            </View>
            <View
              style={[styles.optionList, formErrors.ward && styles.selectError]}
            >
              <ScrollView
                ref={wardListRef}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {wardLoading ? (
                  <View style={styles.provinceLoadingWrap}>
                    <ActivityIndicator size="small" color={Colors.light.tint} />
                    <Text style={styles.provinceLoadingText}>
                      Đang tải phường/xã...
                    </Text>
                  </View>
                ) : null}

                {!wardLoading && selectedDistrictCode && wards.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có dữ liệu phường/xã
                  </Text>
                ) : null}

                {!wardLoading &&
                selectedDistrictCode &&
                wards.length > 0 &&
                filteredWards.length === 0 ? (
                  <Text style={styles.provinceEmptyText}>
                    Không có kết quả phù hợp
                  </Text>
                ) : null}

                {filteredWards.map((ward) => (
                  <TouchableOpacity
                    key={ward.code}
                    style={[
                      styles.optionItem,
                      selectedWardCode === ward.code && styles.optionItemActive,
                    ]}
                    onLayout={(event) => {
                      wardItemYRef.current[ward.code] =
                        event.nativeEvent.layout.y;
                    }}
                    onPress={() => handleSelectWard(ward.code)}
                  >
                    <View style={styles.optionItemRow}>
                      {selectedWardCode === ward.code ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="white"
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={16}
                          color="#9ca3af"
                        />
                      )}
                      <Text
                        style={[
                          styles.optionText,
                          selectedWardCode === ward.code &&
                            styles.optionTextActive,
                        ]}
                      >
                        {ward.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextInput
              style={[styles.input, formErrors.city && styles.inputError]}
              placeholder="Thành phố / quận huyện"
              value={formData.city}
              editable={cityFallbackMode}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, city: text }));
                setFormErrors((prev) => ({ ...prev, city: undefined }));
              }}
            />
            {formErrors.city ? (
              <Text style={styles.fieldErrorText}>{formErrors.city}</Text>
            ) : null}
            <Text style={styles.autoFillHintText}>
              {cityFallbackMode
                ? "Bạn có thể nhập quận/huyện thủ công khi API khu vực không khả dụng."
                : "Trường này được tự động tạo từ quận/huyện và phường/xã."}
            </Text>
            <TextInput
              ref={addressLineInputRef}
              style={[
                styles.input,
                styles.textArea,
                formErrors.address_line && styles.inputError,
              ]}
              placeholder="Số nhà, tên đường"
              value={formData.address_line}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, address_line: text }));
                setFormErrors((prev) => ({ ...prev, address_line: undefined }));
              }}
              multiline
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => postalCodeInputRef.current?.focus()}
              autoCapitalize="sentences"
              autoCorrect={false}
              editable={!saving}
            />
            {formErrors.address_line ? (
              <Text style={styles.fieldErrorText}>
                {formErrors.address_line}
              </Text>
            ) : null}
            <TextInput
              ref={postalCodeInputRef}
              style={[
                styles.input,
                formErrors.postal_code && styles.inputError,
              ]}
              placeholder="Mã bưu chính"
              value={formData.postal_code}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, postal_code: text }));
                setFormErrors((prev) => ({ ...prev, postal_code: undefined }));
              }}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => {
                postalCodeInputRef.current?.blur();
              }}
              editable={!saving}
            />
            {formErrors.postal_code ? (
              <Text style={styles.fieldErrorText}>
                {formErrors.postal_code}
              </Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footerRow,
              { paddingBottom: 8 + Math.max(insets.bottom, 8) },
            ]}
          >
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={closeModal}
            >
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, saving && { opacity: 0.7 }]}
              onPress={handleSaveAddress}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmButtonText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>

          {modalVisible ? (
            <ToastBanner
              message={toast?.message ?? null}
              type={toast?.type}
              onDismiss={() => setToast(null)}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      <ConfirmActionModal
        visible={deleteModalVisible}
        title="Xóa địa chỉ"
        message="Bạn có chắc muốn xóa địa chỉ này?"
        confirmLabel="Xóa"
        destructive
        onConfirm={() => {
          void handleConfirmDeleteAddress();
        }}
        onCancel={() => {
          setDeleteModalVisible(false);
          setPendingDeleteAddressId(null);
        }}
      />

      {!modalVisible ? (
        <ToastBanner
          message={toast?.message ?? null}
          type={toast?.type}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  content: { flex: 1, padding: 12 },
  singleAddressHint: { color: "#b45309", fontSize: 12, marginBottom: 8 },
  addressCard: {
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 10,
  },
  addressCardSelected: { borderColor: Colors.light.tint },
  addressSelectArea: { borderRadius: 6 },
  addressRow: { flexDirection: "row", alignItems: "center" },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
  },
  addressBody: { flex: 1 },
  addressTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  addressName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  defaultTag: {
    fontSize: 10,
    color: Colors.light.tint,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: "700",
  },
  addressMeta: { fontSize: 12, color: "#4b5563", marginTop: 2 },
  actionsRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionButtonDisabled: { backgroundColor: "#f3f4f6" },
  actionText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  actionTextDisabled: { color: "#9ca3af" },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  useAddressButton: {
    backgroundColor: "#e62c2f",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  useAddressButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  useAddressButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  confirmButtonText: { color: "white", fontWeight: "700", fontSize: 15 },
  modalContent: { flex: 1 },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
    color: "#333",
  },
  inputError: {
    borderColor: "#dc2626",
    backgroundColor: "#fff5f5",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    fontSize: 12,
    color: "#333",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInputFlex: { flex: 1 },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    marginBottom: 8,
  },
  optionList: {
    maxHeight: 170,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 6,
  },
  selectError: {
    borderColor: "#dc2626",
    backgroundColor: "#fff5f5",
  },
  selectedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  selectedInfoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  selectedInfoValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
    flexShrink: 1,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: "#f9fafb",
  },
  optionItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionItemActive: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint,
  },
  optionText: { fontSize: 12, fontWeight: "600", color: "#333" },
  optionTextActive: { color: "white" },
  textArea: { height: 70, textAlignVertical: "top" },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  provinceLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  provinceLoadingText: { fontSize: 12, color: "#4b5563" },
  provinceEmptyText: { fontSize: 12, color: "#6b7280", paddingVertical: 6 },
  provinceErrorText: { fontSize: 12, color: "#dc2626", marginBottom: 8 },
  fieldErrorText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: -8,
    marginBottom: 10,
  },
  errorLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    marginBottom: 8,
  },
  retryButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "700",
  },
  autoFillHintText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: -4,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "white",
  },
  secondaryButtonText: { color: "#4b5563", fontWeight: "600" },
});
