import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { addressService } from '@/services/addressService';
import { couponService } from '@/services/couponService';
import { orderService } from '@/services/orderService';
import { Address } from '@/types/address';
import { Coupon } from '@/types/counpons';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PAYMENT_METHODS = [
  { id: 'MOMO', name: 'MegaPay Wallet', icon: 'wallet' },
  { id: 'CARD', name: 'Credit/Debit Card', icon: 'card' },
  { id: 'COD', name: 'Cash on Delivery', icon: 'cash' },
];

const PROVINCES = [
  { id: 1, name: 'Ho Chi Minh City' },
  { id: 2, name: 'Ha Noi' },
  { id: 3, name: 'Da Nang' },
];

export default function InvoiceScreen() {
  const { cartItems, getTotalPrice, clearCart, updateQuantity } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState('MOMO');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [formData, setFormData] = useState({ full_name: '', phone: '', address_line: '', postal_code: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponModalVisible, setCouponModalVisible] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (!user?.id) {
        setLoading(false);
      } else {
        try {
          const data = await addressService.getAddressesByUser(user.id);
          setAddresses(data);
          const defaultAddr = data.find((a) => a.is_default);
          setSelectedAddress(defaultAddr?.id || data[0]?.id || null);
        } catch (error) {
          console.error('Error loading addresses:', error);
        } finally {
          setLoading(false);
        }
      }

      try {
        const coupons = await couponService.getCoupons();
        setAvailableCoupons(coupons);
      } catch (error) {
        console.error('Error loading coupons:', error);
      }
    };

    void bootstrap();
  }, [user?.id]);

  const openAddressModal = () => {
    setFormData({ full_name: '', phone: '', address_line: '', postal_code: '' });
    setSelectedProvince(null);
    setModalVisible(true);
  };

  const handleSaveAddress = async () => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please log in to add an address', [
        { text: 'Cancel' },
        { text: 'Login', onPress: () => router.push('/loginform/loginscreen') },
      ]);
      return;
    }

    if (!formData.full_name || !formData.phone || !formData.address_line || !selectedProvince) {
      Alert.alert('Validation Error', 'Please fill all fields');
      return;
    }

    const provinceName = PROVINCES.find((p) => p.id === selectedProvince)?.name || '';

    try {
      const newAddress = await addressService.createAddress({
        user_id: user.id,
        full_name: formData.full_name,
        phone: formData.phone,
        address_line: formData.address_line,
        city: formData.address_line,
        province: provinceName,
        postal_code: formData.postal_code,
        is_default: addresses.length === 0,
      });

      if (newAddress) {
        setAddresses((prev) => [...prev, newAddress]);
        setSelectedAddress(newAddress.id);
        setModalVisible(false);
        Alert.alert('Success', 'Address added');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const handleDeleteAddress = (id: number) => {
    Alert.alert('Delete', 'Remove this address?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await addressService.deleteAddress(id);
          setAddresses((prev) => {
            const nextAddresses = prev.filter((address) => address.id !== id);
            if (selectedAddress === id) {
              setSelectedAddress(nextAddresses[0]?.id || null);
            }
            return nextAddresses;
          });
        },
      },
    ]);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    const subtotal = getTotalPrice();
    const validation = await couponService.validateCoupon(couponCode, subtotal);

    if (validation.valid) {
      setAppliedCoupon(validation.coupon!);
      setCouponDiscount(validation.discount);
      setCouponError('');
      Alert.alert('Success', validation.message);
    } else {
      setCouponError(validation.message);
      setAppliedCoupon(null);
      setCouponDiscount(0);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode('');
    setCouponError('');
  };

  const openCouponModal = () => {
    setCouponModalVisible(true);
  };

  const selectCoupon = (coupon: Coupon) => {
    setAppliedCoupon(coupon);
    setCouponDiscount(0); // Reset discount, will be calculated in handleApplyCoupon
    setCouponModalVisible(false);
    // Optionally, auto-apply the coupon
    handleApplyCouponForSelected(coupon);
  };

  const handleApplyCouponForSelected = async (coupon: Coupon) => {
    const subtotal = getTotalPrice();
    const validation = await couponService.validateCoupon(coupon.code, subtotal);
    if (validation.valid) {
      setAppliedCoupon(validation.coupon!);
      setCouponDiscount(validation.discount);
      setCouponError('');
      Alert.alert('Success', validation.message);
    } else {
      setCouponError(validation.message);
      setAppliedCoupon(null);
      setCouponDiscount(0);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please log in to place an order', [
        { text: 'Cancel' },
        { text: 'Login', onPress: () => router.push('/loginform/loginscreen') },
      ]);
      return;
    }

    if (!selectedAddress) {
      Alert.alert('Please select address');
      return;
    }

    try {
      setSubmitting(true);
      const order = await orderService.createOrder({
        address_id: selectedAddress,
        coupon_code: appliedCoupon?.code,
        payment_method: selectedPayment,
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
      });

      if (order) {
        clearCart();
        Alert.alert('Success', 'Order placed!', [
          { text: 'Continue', onPress: () => router.push('/') },
        ]);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SafeAreaView style={s.container}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={s.title}>Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.content}>
        {/* Address Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Address</Text>
            <TouchableOpacity style={s.addBtn} onPress={openAddressModal}>
              <Ionicons name="add" size={14} color="white" />
            </TouchableOpacity>
          </View>

          {addresses.length === 0 ? (
            <TouchableOpacity style={s.emptyBtn} onPress={openAddressModal}>
              <Text style={s.emptyBtnText}>Add Address</Text>
            </TouchableOpacity>
          ) : (
            addresses.map((item) => (
              <TouchableOpacity
                key={item.id.toString()}
                style={[s.addressItem, selectedAddress === item.id && s.addressItemSelected]}
                onPress={() => setSelectedAddress(item.id)}
              >
                <View style={s.radio}>
                  {selectedAddress === item.id && <View style={s.radioDot} />}
                </View>
                <View style={s.flex1}>
                  <Text style={s.bold12}>{item.full_name}</Text>
                  <Text style={s.text11}>{item.address_line}</Text>
                  <Text style={s.text11}>{item.city}, {item.province}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAddress(item.id)}>
                  <Ionicons name="trash-outline" size={16} color="red" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Products Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Items</Text>
          {cartItems.map((item) => (
            <View key={item.product.id.toString()} style={s.productCard}>
              <Image source={{ uri: item.product.thumbnail  || undefined}} style={s.productImage} />
              <View style={s.flex1}>
                <Text style={s.bold13}>{item.product.name}</Text>
                <Text style={s.priceText}>${item.product.price}</Text>
                <View style={s.quantityControl}>
                  <TouchableOpacity onPress={() => updateQuantity(item.product.id, item.quantity - 1)}>
                    <Ionicons name="remove" size={18} color="#666" />
                  </TouchableOpacity>
                  <Text style={s.quantity}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.product.id, item.quantity + 1)}>
                    <Ionicons name="add" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={s.priceText}>${(item.product.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Coupon Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Coupon</Text>
          {appliedCoupon ? (
            <View style={s.appliedCoupon}>
              <View style={s.flex1}>
                <Text style={s.bold13}>{appliedCoupon.code}</Text>
                <Text style={s.text11}>{appliedCoupon.description}</Text>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon}>
                <Ionicons name="close" size={20} color="red" />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity style={s.selectCouponBtn} onPress={openCouponModal}>
                <Text style={s.selectCouponBtnText}>Select Coupon</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.light.tint} />
              </TouchableOpacity>
              <TextInput
                style={s.input}
                placeholder="Or enter coupon code"
                value={couponCode}
                onChangeText={setCouponCode}
              />
              {couponError ? <Text style={s.errorText}>{couponError}</Text> : null}
              <TouchableOpacity style={s.applyBtn} onPress={handleApplyCoupon}>
                <Text style={s.applyBtnText}>Apply Coupon</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment</Text>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[s.paymentItem, selectedPayment === method.id && s.paymentItemSelected]}
              onPress={() => setSelectedPayment(method.id)}
            >
              <View style={s.radio}>
                {selectedPayment === method.id && <View style={s.radioDot} />}
              </View>
              <Ionicons name={method.icon as any} size={20} color={selectedPayment === method.id ? Colors.light.tint : '#999'} />
              <Text style={s.bold13}>{method.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Section */}
        <View style={s.summaryBox}>
          {[
            { label: 'Subtotal', value: getTotalPrice().toFixed(2) },
            { label: 'Tax (10%)', value: (getTotalPrice() * 0.1).toFixed(2) },
            { label: 'Shipping', value: '5.00' },
            ...(couponDiscount > 0 ? [{ label: 'Discount', value: `-${couponDiscount.toFixed(2)}` }] : []),
          ].map((row, i) => (
            <View key={i} style={s.summaryRow}>
              <Text style={s.text13}>{row.label}</Text>
              <Text style={s.text13}>${row.value}</Text>
            </View>
          ))}
          <View style={s.summaryRowTotal}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmount}>${(getTotalPrice() * 1.1 + 5 - couponDiscount).toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.orderBtn, !selectedAddress && { opacity: 0.5 }]}
          disabled={!selectedAddress || submitting}
          onPress={handlePlaceOrder}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text style={s.orderBtnText}>Place Order</Text>}
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Address</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={s.modalContent}>
            <TextInput style={s.input} placeholder="Full Name" value={formData.full_name} onChangeText={(text) => setFormData({ ...formData, full_name: text })} />
            <TextInput style={s.input} placeholder="Phone" value={formData.phone} onChangeText={(text) => setFormData({ ...formData, phone: text })} keyboardType="phone-pad" />
            
            <Text style={s.label}>Province</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {PROVINCES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.provinceBtn, selectedProvince === p.id && s.provinceBtnSelected]}
                  onPress={() => setSelectedProvince(p.id)}
                >
                  <Text style={[s.text12, selectedProvince === p.id && s.colorWhite]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput style={[s.input, s.textArea]} placeholder="Street Address" value={formData.address_line} onChangeText={(text) => setFormData({ ...formData, address_line: text })} multiline />
            <TextInput style={s.input} placeholder="Postal Code" value={formData.postal_code} onChangeText={(text) => setFormData({ ...formData, postal_code: text })} />
          </ScrollView>

          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSaveAddress}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Coupon Modal */}
      <Modal visible={couponModalVisible} animationType="slide" onRequestClose={() => setCouponModalVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setCouponModalVisible(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Select Coupon</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={s.modalContent}>
            {availableCoupons.length === 0 ? (
              <Text style={s.text13}>No available coupons</Text>
            ) : (
              availableCoupons.map((item) => (
                <TouchableOpacity
                  key={item.id.toString()}
                  style={s.couponItem}
                  onPress={() => selectCoupon(item)}
                >
                  <View style={s.flex1}>
                    <Text style={s.bold13}>{item.code}</Text>
                    <Text style={s.text11}>{item.description}</Text>
                    <Text style={s.text11}>Min order: ${item.min_order_value}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.light.tint} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.light.tint },
  title: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  content: { flex: 1, padding: 12 },
  section: { marginBottom: 16, backgroundColor: 'white', borderRadius: 8, padding: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  addBtn: { backgroundColor: Colors.light.tint, width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { backgroundColor: Colors.light.tint, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  emptyBtnText: { color: 'white', fontWeight: '600' },
  
  addressItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 2, borderColor: '#e0e0e0' },
  addressItemSelected: { borderColor: Colors.light.tint },
  
  productCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  productImage: { width: 60, height: 60, borderRadius: 6, marginRight: 10 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantity: { fontSize: 12, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  
  paymentItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 2, borderColor: '#e0e0e0' },
  paymentItemSelected: { borderColor: Colors.light.tint },
  
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.tint },
  
  summaryBox: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  summaryRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, backgroundColor: Colors.light.tint, marginHorizontal: -12, paddingHorizontal: 12, marginTop: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: 'white' },
  totalAmount: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  orderBtn: { backgroundColor: Colors.light.tint, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  orderBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  
  modal: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.light.tint },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  modalContent: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, backgroundColor: '#f9f9f9' },
  textArea: { height: 70, textAlignVertical: 'top' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  provinceBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#f9f9f9' },
  provinceBtnSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  modalFooter: { flexDirection: 'row', padding: 12, gap: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: Colors.light.tint, borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  
  appliedCoupon: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, borderWidth: 2, borderColor: Colors.light.tint, backgroundColor: '#f0f8ff' },
  errorText: { fontSize: 12, color: 'red', marginBottom: 8 },
  applyBtn: { backgroundColor: Colors.light.tint, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: '600' },
  selectCouponBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: '#f9f9f9' },
  selectCouponBtnText: { fontSize: 13, fontWeight: '600', color: '#333' },
  couponItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: 'white' },

  // Utilities
  flex1: { flex: 1 },
  text11: { fontSize: 11, color: '#666' },
  text12: { fontSize: 12, fontWeight: '600', color: '#333' },
  text13: { fontSize: 13 },
  bold12: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  bold13: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
  priceText: { fontSize: 13, fontWeight: 'bold', color: Colors.light.tint },
  colorWhite: { color: 'white' },
});
