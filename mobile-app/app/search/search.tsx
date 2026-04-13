import ProductCard from '@/components/product-card';
import { Colors } from '@/constants/theme';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';

export default function SearchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setProducts([]);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Add to history if not already present
    if (!searchHistory.includes(query.trim())) {
      setSearchHistory(prev => [query.trim(), ...prev]);
    }
    setShowSuggestions(false);
    setLoading(true);
    const results = await productService.searchProducts(query);
    setProducts(results);
    setLoading(false);
  };

  const selectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const clearHistory = () => {
    setSearchHistory([]);
  };

  const toggleShowAllSuggestions = () => {
    setShowAllSuggestions(!showAllSuggestions);
  };


  React.useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions(searchHistory.slice(0, showAllSuggestions ? searchHistory.length : 5));
      setShowSuggestions(searchHistory.length > 0);
    } else {
      // Filter history based on query
      const filtered = searchHistory.filter(item =>
        item.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, showAllSuggestions ? undefined : 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  }, [searchQuery, searchHistory, showAllSuggestions]);

  const renderProductItem = ({ item }: { item: Product }) => (
    <ProductCard product={item} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.tint} />
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme].tint }]}
            placeholder="Search products..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              handleSearch(text);
            }}
          />
          <TouchableOpacity>
            <Ionicons name="camera" size={24} color="#888" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchIconButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Ionicons name="trash-outline" size={20} color={Colors.light.tint} />
            </TouchableOpacity>
          </View>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => selectSuggestion(suggestion)}
            >
              <Ionicons name="time-outline" size={16} color="#888" />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
          {searchHistory.length > 5 && !showAllSuggestions && (
            <TouchableOpacity style={styles.showMoreButton} onPress={toggleShowAllSuggestions}>
              <Text style={styles.showMoreText}>Show More</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.light.tint} />
            </TouchableOpacity>
          )}
          {showAllSuggestions && (
            <TouchableOpacity style={styles.showMoreButton} onPress={toggleShowAllSuggestions}>
              <Text style={styles.showMoreText}>Show Less</Text>
              <Ionicons name="chevron-up" size={16} color={Colors.light.tint} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          style={styles.contentScroll}
          data={products}
          renderItem={renderProductItem}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          ListEmptyComponent={
            searchQuery === '' ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Start typing to search products...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{`No products found for "${searchQuery}"`}</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  header: {
    flex: 0.1,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 5,
    height: 40,
    marginRight: 10,
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.tint,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
  },
  searchInput: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderTopWidth: 0,
    maxHeight: 300,
    marginBottom: 10,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  showMoreText: {
    fontSize: 14,
    color: Colors.light.tint,
    marginRight: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentScroll: {
    flex: 0.9,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
