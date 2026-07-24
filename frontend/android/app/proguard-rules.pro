# ============================================================
# Vishva ERP v4.0 — Advanced ProGuard/R8 Configuration
# ============================================================

# ---- Hermes JS Engine ----
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.intl.** { *; }

# ---- React Native Core ----
-keep,allowobfuscation class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep,allowobfuscation class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { @com.facebook.react.bridge.annotations.ReactMethod <methods>; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class com.facebook.react.bridge.ReactMethod { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.common.** { *; }
-keep class com.facebook.react.modules.** { *; }

# ---- React Navigation ----
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.gesturehandler.react.** { *; }

# ---- React Native Screens ----
-keep class com.swmansion.screens.** { *; }

# ---- Native Modules (Vishva ERP) — only keep JNI/reflection-accessed classes ----
-keep class com.vishvaerp.MainActivity { *; }
-keep class com.vishvaerp.MainApplication { *; }
-keep class com.vishvaerp.** extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class com.vishvaerp.** extends com.facebook.react.bridge.ReactPackage { *; }

# ---- Socket.IO Client ----
-keep class io.socket.** { *; }
-keep class io.socket.engineio.** { *; }
-keep class io.socket.client.** { *; }

# ---- AsyncStorage ----
-keep class com.reactnativeasyncstorage.** { *; }
-keep class com.facebook.react.modules.storage.** { *; }

# ---- Date/Time Libraries ----
-keep class org.joda.time.** { *; }
-keep class org.threeten.** { *; }

# ---- Firebase Cloud Messaging ----
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.firebase.installations.** { *; }

# ---- Firebase Core ----
-keep class com.google.firebase.FirebaseApp { *; }
-keep class com.google.firebase.analytics.** { *; }

# ---- OkHttp (used internally by React Native) ----
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ---- Glide (image loading) ----
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { <init>(...); }
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** { **[] $VALUES; public *; }

# ---- Custom View Classes ----
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    public void set*(...);
}

# ---- Kotlin Coroutines ----
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
-dontwarn kotlinx.coroutines.**

# ---- Kotlin Serialization ----
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# ---- Kotlin Reflect ----
-keep class kotlin.reflect.** { *; }
-keep class kotlin.Metadata { *; }

# ---- WorkManager (background tasks) ----
-keep class * extends androidx.work.ListenableWorker {
    public <init>(...);
}
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.CoroutineWorker

# ---- Splash Screen ----
-keep class androidx.core.splashscreen.** { *; }

# ---- AndroidX Core — only keep what's actually used ----
-keep class androidx.core.app.** { *; }
-keep class androidx.core.content.** { *; }
-keep class androidx.appcompat.app.** { *; }
-keep class androidx.activity.ComponentActivity { *; }

# ---- General Android Optimizations ----
-repackageclasses ''
-allowaccessmodification
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# ---- Keep Annotations ----
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses,EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- WebView JavaScript Interface ----
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---- Enum Safety ----
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ---- Parcelable ----
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ---- Serializable ----
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ---- Remove logging in release ----
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ---- Remove System.out.println ----
-assumenosideeffects class java.io.PrintStream {
    public void println(...);
    public void print(...);
}

# ---- R8 Diagnostics (advanced transparency) ----
# Print which classes R8 is keeping/discarding
#-whyareyoukeeping class com.vishvaerp.**
#-checkdiscard class com.vishvaerp.**
