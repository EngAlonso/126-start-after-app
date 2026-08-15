// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$UserModel {

 int get id; String get fullName; String get mobile; String? get email; String get role;// customer | technician | admin | super_admin
 String get status; String? get profileImage; String? get jobTitle; String? get createdAt; String? get suspensionReason; String? get bannedUntil; bool get isFounder; TechnicianProfileModel? get technicianProfile;
/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UserModelCopyWith<UserModel> get copyWith => _$UserModelCopyWithImpl<UserModel>(this as UserModel, _$identity);

  /// Serializes this UserModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UserModel&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.mobile, mobile) || other.mobile == mobile)&&(identical(other.email, email) || other.email == email)&&(identical(other.role, role) || other.role == role)&&(identical(other.status, status) || other.status == status)&&(identical(other.profileImage, profileImage) || other.profileImage == profileImage)&&(identical(other.jobTitle, jobTitle) || other.jobTitle == jobTitle)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.suspensionReason, suspensionReason) || other.suspensionReason == suspensionReason)&&(identical(other.bannedUntil, bannedUntil) || other.bannedUntil == bannedUntil)&&(identical(other.isFounder, isFounder) || other.isFounder == isFounder)&&(identical(other.technicianProfile, technicianProfile) || other.technicianProfile == technicianProfile));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,mobile,email,role,status,profileImage,jobTitle,createdAt,suspensionReason,bannedUntil,isFounder,technicianProfile);

@override
String toString() {
  return 'UserModel(id: $id, fullName: $fullName, mobile: $mobile, email: $email, role: $role, status: $status, profileImage: $profileImage, jobTitle: $jobTitle, createdAt: $createdAt, suspensionReason: $suspensionReason, bannedUntil: $bannedUntil, isFounder: $isFounder, technicianProfile: $technicianProfile)';
}


}

/// @nodoc
abstract mixin class $UserModelCopyWith<$Res>  {
  factory $UserModelCopyWith(UserModel value, $Res Function(UserModel) _then) = _$UserModelCopyWithImpl;
@useResult
$Res call({
 int id, String fullName, String mobile, String? email, String role, String status, String? profileImage, String? jobTitle, String? createdAt, String? suspensionReason, String? bannedUntil, bool isFounder, TechnicianProfileModel? technicianProfile
});


$TechnicianProfileModelCopyWith<$Res>? get technicianProfile;

}
/// @nodoc
class _$UserModelCopyWithImpl<$Res>
    implements $UserModelCopyWith<$Res> {
  _$UserModelCopyWithImpl(this._self, this._then);

  final UserModel _self;
  final $Res Function(UserModel) _then;

/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fullName = null,Object? mobile = null,Object? email = freezed,Object? role = null,Object? status = null,Object? profileImage = freezed,Object? jobTitle = freezed,Object? createdAt = freezed,Object? suspensionReason = freezed,Object? bannedUntil = freezed,Object? isFounder = null,Object? technicianProfile = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,mobile: null == mobile ? _self.mobile : mobile // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,profileImage: freezed == profileImage ? _self.profileImage : profileImage // ignore: cast_nullable_to_non_nullable
as String?,jobTitle: freezed == jobTitle ? _self.jobTitle : jobTitle // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,suspensionReason: freezed == suspensionReason ? _self.suspensionReason : suspensionReason // ignore: cast_nullable_to_non_nullable
as String?,bannedUntil: freezed == bannedUntil ? _self.bannedUntil : bannedUntil // ignore: cast_nullable_to_non_nullable
as String?,isFounder: null == isFounder ? _self.isFounder : isFounder // ignore: cast_nullable_to_non_nullable
as bool,technicianProfile: freezed == technicianProfile ? _self.technicianProfile : technicianProfile // ignore: cast_nullable_to_non_nullable
as TechnicianProfileModel?,
  ));
}
/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TechnicianProfileModelCopyWith<$Res>? get technicianProfile {
    if (_self.technicianProfile == null) {
    return null;
  }

  return $TechnicianProfileModelCopyWith<$Res>(_self.technicianProfile!, (value) {
    return _then(_self.copyWith(technicianProfile: value));
  });
}
}


/// Adds pattern-matching-related methods to [UserModel].
extension UserModelPatterns on UserModel {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UserModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UserModel() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UserModel value)  $default,){
final _that = this;
switch (_that) {
case _UserModel():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UserModel value)?  $default,){
final _that = this;
switch (_that) {
case _UserModel() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String fullName,  String mobile,  String? email,  String role,  String status,  String? profileImage,  String? jobTitle,  String? createdAt,  String? suspensionReason,  String? bannedUntil,  bool isFounder,  TechnicianProfileModel? technicianProfile)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UserModel() when $default != null:
return $default(_that.id,_that.fullName,_that.mobile,_that.email,_that.role,_that.status,_that.profileImage,_that.jobTitle,_that.createdAt,_that.suspensionReason,_that.bannedUntil,_that.isFounder,_that.technicianProfile);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String fullName,  String mobile,  String? email,  String role,  String status,  String? profileImage,  String? jobTitle,  String? createdAt,  String? suspensionReason,  String? bannedUntil,  bool isFounder,  TechnicianProfileModel? technicianProfile)  $default,) {final _that = this;
switch (_that) {
case _UserModel():
return $default(_that.id,_that.fullName,_that.mobile,_that.email,_that.role,_that.status,_that.profileImage,_that.jobTitle,_that.createdAt,_that.suspensionReason,_that.bannedUntil,_that.isFounder,_that.technicianProfile);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String fullName,  String mobile,  String? email,  String role,  String status,  String? profileImage,  String? jobTitle,  String? createdAt,  String? suspensionReason,  String? bannedUntil,  bool isFounder,  TechnicianProfileModel? technicianProfile)?  $default,) {final _that = this;
switch (_that) {
case _UserModel() when $default != null:
return $default(_that.id,_that.fullName,_that.mobile,_that.email,_that.role,_that.status,_that.profileImage,_that.jobTitle,_that.createdAt,_that.suspensionReason,_that.bannedUntil,_that.isFounder,_that.technicianProfile);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UserModel implements UserModel {
  const _UserModel({required this.id, required this.fullName, required this.mobile, this.email, required this.role, required this.status, this.profileImage, this.jobTitle, this.createdAt, this.suspensionReason, this.bannedUntil, this.isFounder = false, this.technicianProfile});
  factory _UserModel.fromJson(Map<String, dynamic> json) => _$UserModelFromJson(json);

@override final  int id;
@override final  String fullName;
@override final  String mobile;
@override final  String? email;
@override final  String role;
// customer | technician | admin | super_admin
@override final  String status;
@override final  String? profileImage;
@override final  String? jobTitle;
@override final  String? createdAt;
@override final  String? suspensionReason;
@override final  String? bannedUntil;
@override@JsonKey() final  bool isFounder;
@override final  TechnicianProfileModel? technicianProfile;

/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UserModelCopyWith<_UserModel> get copyWith => __$UserModelCopyWithImpl<_UserModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UserModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UserModel&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.mobile, mobile) || other.mobile == mobile)&&(identical(other.email, email) || other.email == email)&&(identical(other.role, role) || other.role == role)&&(identical(other.status, status) || other.status == status)&&(identical(other.profileImage, profileImage) || other.profileImage == profileImage)&&(identical(other.jobTitle, jobTitle) || other.jobTitle == jobTitle)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.suspensionReason, suspensionReason) || other.suspensionReason == suspensionReason)&&(identical(other.bannedUntil, bannedUntil) || other.bannedUntil == bannedUntil)&&(identical(other.isFounder, isFounder) || other.isFounder == isFounder)&&(identical(other.technicianProfile, technicianProfile) || other.technicianProfile == technicianProfile));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,mobile,email,role,status,profileImage,jobTitle,createdAt,suspensionReason,bannedUntil,isFounder,technicianProfile);

@override
String toString() {
  return 'UserModel(id: $id, fullName: $fullName, mobile: $mobile, email: $email, role: $role, status: $status, profileImage: $profileImage, jobTitle: $jobTitle, createdAt: $createdAt, suspensionReason: $suspensionReason, bannedUntil: $bannedUntil, isFounder: $isFounder, technicianProfile: $technicianProfile)';
}


}

/// @nodoc
abstract mixin class _$UserModelCopyWith<$Res> implements $UserModelCopyWith<$Res> {
  factory _$UserModelCopyWith(_UserModel value, $Res Function(_UserModel) _then) = __$UserModelCopyWithImpl;
@override @useResult
$Res call({
 int id, String fullName, String mobile, String? email, String role, String status, String? profileImage, String? jobTitle, String? createdAt, String? suspensionReason, String? bannedUntil, bool isFounder, TechnicianProfileModel? technicianProfile
});


@override $TechnicianProfileModelCopyWith<$Res>? get technicianProfile;

}
/// @nodoc
class __$UserModelCopyWithImpl<$Res>
    implements _$UserModelCopyWith<$Res> {
  __$UserModelCopyWithImpl(this._self, this._then);

  final _UserModel _self;
  final $Res Function(_UserModel) _then;

/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fullName = null,Object? mobile = null,Object? email = freezed,Object? role = null,Object? status = null,Object? profileImage = freezed,Object? jobTitle = freezed,Object? createdAt = freezed,Object? suspensionReason = freezed,Object? bannedUntil = freezed,Object? isFounder = null,Object? technicianProfile = freezed,}) {
  return _then(_UserModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,mobile: null == mobile ? _self.mobile : mobile // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,profileImage: freezed == profileImage ? _self.profileImage : profileImage // ignore: cast_nullable_to_non_nullable
as String?,jobTitle: freezed == jobTitle ? _self.jobTitle : jobTitle // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,suspensionReason: freezed == suspensionReason ? _self.suspensionReason : suspensionReason // ignore: cast_nullable_to_non_nullable
as String?,bannedUntil: freezed == bannedUntil ? _self.bannedUntil : bannedUntil // ignore: cast_nullable_to_non_nullable
as String?,isFounder: null == isFounder ? _self.isFounder : isFounder // ignore: cast_nullable_to_non_nullable
as bool,technicianProfile: freezed == technicianProfile ? _self.technicianProfile : technicianProfile // ignore: cast_nullable_to_non_nullable
as TechnicianProfileModel?,
  ));
}

/// Create a copy of UserModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TechnicianProfileModelCopyWith<$Res>? get technicianProfile {
    if (_self.technicianProfile == null) {
    return null;
  }

  return $TechnicianProfileModelCopyWith<$Res>(_self.technicianProfile!, (value) {
    return _then(_self.copyWith(technicianProfile: value));
  });
}
}

// dart format on
