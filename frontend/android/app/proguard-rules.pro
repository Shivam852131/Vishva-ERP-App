# ============================================================
# Vishva ERP v4.0.1 — ProGuard / R8 Configuration
# ============================================================

# ---- Do NOT obfuscate or strip JNI / C++ Native Bindings ----
-dontwarn **

# ---- Hermes JS Engine & React Native Core ----
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.soloader.** { *; }

-keep,allowobfuscation class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep,allowobfuscation class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { @com.facebook.react.bridge.annotations.ReactMethod <methods>; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class com.facebook.react.bridge.ReactMethod { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ---- Vishva ERP Main Application & Activity ----
-keep class com.vishvaerp.** { *; }

# ---- Nitro Modules ----
-keep class com.margelo.nitro.** { *; }

# ---- Vision Camera ----
-keep class com.mrousavy.camera.** { *; }

# ---- Reanimated, Worklets, Screens & Gesture Handler ----
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.screens.** { *; }
-keep class com.worklets.** { *; }

# ---- Document Picker ----
-keep class com.reactnativedocumentpicker.** { *; }

# ---- React Native FS ----
-keep class com.rnfs.** { *; }

# ---- React Native WebView ----
-keep class com.reactnativecommunity.webview.** { *; }

# ---- React Native SVG ----
-keep class com.horcrux.svg.** { *; }

# ---- React Native Image Picker ----
-keep class com.imagepicker.** { *; }

# ---- React Native Geolocation ----
-keep class com.reactnativecommunity.geolocation.** { *; }

# ---- React Native Safe Area Context ----
-keep class com.th3rdwave.safeareacontext.** { *; }

# ---- Async Storage ----
-keep class com.reactnativeasyncstorage.** { *; }

# ---- Socket.IO Client ----
-keep class io.socket.** { *; }
-keep class io.socket.engineio.** { *; }
-keep class io.socket.client.** { *; }

# ---- Firebase ----
-keep class com.google.firebase.** { *; }

# ---- OkHttp & Okio ----
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ---- AndroidX & Splash Screen ----
-keep class androidx.core.splashscreen.** { *; }
-keep class androidx.core.** { *; }
-keep class androidx.appcompat.** { *; }

# ---- Keep Annotations & Signatures ----
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses,EnclosingMethod
-keepattributes SourceFile,LineNumberTable
