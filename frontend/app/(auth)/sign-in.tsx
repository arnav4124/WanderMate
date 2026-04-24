import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, Button, TextInput, useTheme, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
} from 'firebase/auth';
import { auth } from '@/config/firebase';

export default function SignInScreen() {
    const theme = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleEmailAuth = async () => {
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                if (!name) {
                    setError('Please enter your name');
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            const message = err.code === 'auth/invalid-credential'
                ? 'Invalid email or password'
                : err.code === 'auth/email-already-in-use'
                    ? 'Email already in use'
                    : err.code === 'auth/weak-password'
                        ? 'Password should be at least 6 characters'
                        : err.message;
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="airplane" size={48} color={theme.colors.primary} />
                        </View>
                        <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.primary }]}>
                            WanderMate
                        </Text>
                        <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Plan trips together, explore the world
                        </Text>
                    </View>

                    {/* Form */}
                    <Surface style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
                        <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </Text>

                        {isSignUp && (
                            <TextInput
                                label="Full Name"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                style={styles.input}
                                left={<TextInput.Icon icon="account-outline" />}
                                autoCapitalize="words"
                            />
                        )}

                        <TextInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            mode="outlined"
                            style={styles.input}
                            left={<TextInput.Icon icon="email-outline" />}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TextInput
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            mode="outlined"
                            style={styles.input}
                            left={<TextInput.Icon icon="lock-outline" />}
                            right={
                                <TextInput.Icon
                                    icon={showPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowPassword(!showPassword)}
                                />
                            }
                            secureTextEntry={!showPassword}
                        />

                        {error ? (
                            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
                        ) : null}

                        <Button
                            mode="contained"
                            onPress={handleEmailAuth}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </Button>

                        <Button
                            mode="text"
                            onPress={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                            }}
                            style={styles.switchButton}
                        >
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </Button>
                    </Surface>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontWeight: '800',
        letterSpacing: 1,
    },
    subtitle: {
        marginTop: 8,
        textAlign: 'center',
    },
    formCard: {
        borderRadius: 24,
        padding: 24,
    },
    formTitle: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
    },
    input: {
        marginBottom: 12,
    },
    error: {
        fontSize: 13,
        marginBottom: 8,
        textAlign: 'center',
    },
    button: {
        marginTop: 8,
        borderRadius: 12,
    },
    buttonContent: {
        paddingVertical: 6,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    switchButton: {
        marginTop: 12,
    },
});
