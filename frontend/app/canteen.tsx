import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton, BadgePill, TabSelector, EmptyState } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Utensils, Wallet, Plus, ShoppingBag, ArrowLeft, Clock,
  CheckCircle, Coffee, Sparkles, Check, ChevronRight
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';

export default function CanteenScreen() {
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'wallet'>('menu');
  const [category, setCategory] = useState<string>('All');
  const [cart, setCart] = useState<{ [key: string]: { item: any; count: number } }>({});
  const [topupAmount, setTopupAmount] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);

  const { data: menuData, loading: loadingMenu } = useFetch<{ items: any[] }>('/canteen/menu');
  const { data: walletData, refresh: refreshWallet } = useFetch<{ balance: number; transactions: any[] }>('/canteen/wallet');
  const { data: ordersData, refresh: refreshOrders } = useFetch<{ orders: any[] }>('/canteen/orders');

  const { mutate: placeOrder, loading: ordering } = useMutate('/canteen/order');
  const { mutate: topupWallet, loading: toppingUp } = useMutate('/canteen/wallet/topup');

  const menuItems = menuData?.items || [];
  const balance = walletData?.balance ?? 500;
  const transactions = walletData?.transactions || [];
  const orders = ordersData?.orders || [];

  const categories = ['All', 'Snacks', 'Breakfast', 'Meals', 'Beverages', 'Healthy'];

  const filteredItems = useMemo(() => {
    if (category === 'All') return menuItems;
    return menuItems.filter(i => i.category === category);
  }, [menuItems, category]);

  const cartItems = Object.values(cart);
  const totalCartAmount = cartItems.reduce((sum, c) => sum + c.item.price * c.count, 0);

  const addToCart = (item: any) => {
    setCart(prev => {
      const current = prev[item.id]?.count || 0;
      return {
        ...prev,
        [item.id]: { item, count: current + 1 },
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const current = prev[itemId]?.count || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], count: current - 1 },
      };
    });
  };

  const handleCheckout = async () => {
    if (totalCartAmount <= 0) return;
    if (totalCartAmount > balance) {
      return Alert.alert('Insufficient Balance', 'Your wallet balance is lower than total order cost. Please top up.');
    }

    try {
      const formattedItems = cartItems.map(c => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.count,
      }));

      await placeOrder({ items: formattedItems, totalAmount: totalCartAmount });
      Alert.alert('Order Placed!', `Your canteen food order has been placed successfully.`);
      setCart({});
      refreshWallet();
      refreshOrders();
      setActiveTab('orders');
    } catch (err: any) {
      Alert.alert('Order Failed', err.message || 'Could not place canteen order.');
    }
  };

  const handleTopup = async () => {
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter a valid top-up amount.');
    try {
      await topupWallet({ amount: amt });
      Alert.alert('Wallet Recharged!', `₹${amt} added to your campus canteen wallet.`);
      setTopupAmount('');
      setShowTopupModal(false);
      refreshWallet();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to recharge wallet.');
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#D97706', '#B45309']} style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#FFFFFF" size={24} />
            </Pressable>
            <Text style={styles.headerTitle}>Campus Canteen</Text>
            <Utensils color="#FFFFFF" size={24} />
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View>
              <Text style={styles.balanceLabel}>Campus Wallet Balance</Text>
              <Text style={styles.balanceValue}>₹{balance}</Text>
            </View>
            <Pressable style={styles.topupButton} onPress={() => setShowTopupModal(true)}>
              <Plus color="#B45309" size={16} />
              <Text style={styles.topupButtonText}>Top Up</Text>
            </Pressable>
          </View>

          <TabSelector
            tabs={[
              { id: 'menu', label: 'Menu & Order' },
              { id: 'orders', label: 'My Orders' },
              { id: 'wallet', label: 'Wallet Log' },
            ]}
            activeTab={activeTab}
            onSelect={(tab: any) => setActiveTab(tab)}
          />
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {activeTab === 'menu' ? (
            <View>
              {/* Category Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.catChip, category === cat && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Menu List */}
              <SectionTitle title="Available Food Items" icon={Coffee} />
              {filteredItems.map(item => {
                const inCartCount = cart[item.id]?.count || 0;
                return (
                  <Card key={item.id} style={styles.itemCard}>
                    <View style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemCat}>{item.category}</Text>
                        <Text style={styles.itemPrice}>₹{item.price}</Text>
                      </View>
                      <View style={styles.cartActionRow}>
                        {inCartCount > 0 ? (
                          <View style={styles.qtyControl}>
                            <Pressable style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                              <Text style={styles.qtyBtnText}>-</Text>
                            </Pressable>
                            <Text style={styles.qtyVal}>{inCartCount}</Text>
                            <Pressable style={styles.qtyBtn} onPress={() => addToCart(item)}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable style={styles.addCartBtn} onPress={() => addToCart(item)}>
                            <Text style={styles.addCartBtnText}>ADD</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </Card>
                );
              })}

              {/* Cart Footer Bar */}
              {totalCartAmount > 0 ? (
                <Card style={styles.cartBar}>
                  <View>
                    <Text style={styles.cartItemsCount}>{cartItems.length} items in cart</Text>
                    <Text style={styles.cartTotalAmt}>Total: ₹{totalCartAmount}</Text>
                  </View>
                  <GradientButton
                    title={ordering ? 'Placing...' : 'Pay & Order'}
                    onPress={handleCheckout}
                    disabled={ordering}
                  />
                </Card>
              ) : null}
            </View>
          ) : activeTab === 'orders' ? (
            <View>
              <SectionTitle title="Order History & Live Tokens" icon={ShoppingBag} />
              {orders.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No Orders Yet"
                  subtitle="Your canteen food orders will appear here."
                />
              ) : (
                orders.map((ord: any) => (
                  <Card key={ord._id || ord.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.tokenText}>Token #{ord.tokenNumber || '101'}</Text>
                      <BadgePill label={ord.status.toUpperCase()} color="#D97706" />
                    </View>
                    <Text style={styles.orderDate}>{new Date(ord.createdAt).toLocaleString()}</Text>
                    <View style={styles.orderDivider} />
                    {Array.isArray(ord.items) && ord.items.map((it: any, idx: number) => (
                      <Text key={idx} style={styles.orderItemRow}>
                        • {it.name} x{it.quantity} (₹{it.price * it.quantity})
                      </Text>
                    ))}
                    <Text style={styles.orderTotal}>Paid: ₹{ord.totalAmount}</Text>
                  </Card>
                ))
              )}
            </View>
          ) : (
            <View>
              <SectionTitle title="Wallet Transactions" icon={Wallet} />
              {transactions.length === 0 ? (
                <Text style={styles.emptyTxText}>No transaction history available.</Text>
              ) : (
                transactions.map((tx: any) => (
                  <Card key={tx._id || tx.id} style={styles.txCard}>
                    <View style={styles.txRow}>
                      <View>
                        <Text style={styles.txDesc}>{tx.description}</Text>
                        <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.txAmt, tx.type === 'credit' ? styles.txCredit : styles.txDebit]}>
                        {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Topup Modal */}
        <Modal visible={showTopupModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Card style={styles.modalContent}>
              <Text style={styles.modalTitle}>Recharge Campus Wallet</Text>
              <Text style={styles.modalSub}>Enter amount to add via Razorpay payment gateway:</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter amount (e.g. 200)"
                keyboardType="numeric"
                value={topupAmount}
                onChangeText={setTopupAmount}
              />

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowTopupModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <GradientButton
                  title={toppingUp ? 'Adding...' : 'Add Funds'}
                  onPress={handleTopup}
                  disabled={toppingUp}
                />
              </View>
            </Card>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#FEF3C7',
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  topupButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topupButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  catScroll: {
    marginBottom: 14,
  },
  catChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#D97706',
  },
  catChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  itemCard: {
    marginBottom: 10,
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemCat: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 4,
  },
  cartActionRow: {},
  addCartBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addCartBtnText: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 12,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    borderRadius: 6,
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  qtyVal: {
    color: '#FFFFFF',
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  cartBar: {
    marginTop: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
  },
  cartItemsCount: {
    fontSize: 12,
    color: '#92400E',
  },
  cartTotalAmt: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B45309',
  },
  orderCard: {
    marginBottom: 12,
    padding: 14,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  orderItemRow: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 8,
  },
  emptyTxText: {
    textAlign: 'center',
    color: '#6B7280',
    marginVertical: 20,
  },
  txCard: {
    marginBottom: 8,
    padding: 12,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  txDate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  txAmt: {
    fontSize: 16,
    fontWeight: '700',
  },
  txCredit: {
    color: '#10B981',
  },
  txDebit: {
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalSub: {
    fontSize: 13,
    color: '#6B7280',
    marginVertical: 8,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginVertical: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
  },
});
